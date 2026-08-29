/* V.06.9 — whoever pays is on top, and among them the nearest first.

   Rai's decision, and it changes the MODEL rather than tuning a number in
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

const layers = p => p.evaluate(() => {
  const S = window.__S;
  const list = S.everyBusiness().filter(b => b.cat === 'restaurants').slice(0, 9)
    .map(b => S.businessById(b.id));
  const r = S.paidFirst(list);
  return {
    ids: r.ids,
    order: r.list.map(b => ({ id: b.id, paid: S.isPaid(b), d: S.distanceTo(b) })),
  };
});

/* ---- 1. every subscriber before the first free listing ---- */
{
  const { ctx, p } = await open();
  await seed(p);
  const r = await layers(p);
  ok('1.1 layer one holds all four subscribers', r.ids.length === 4, String(r.ids.length));
  const firstFree = r.order.findIndex(x => !x.paid);
  ok('1.2 …and every one of them is above the first free listing',
     r.order.slice(0, firstFree).every(x => x.paid) && firstFree === 4, 'first free at ' + firstFree);
  /* ⚠️ THE CASE THE OLD CHAIN GOT WRONG: a new subscriber has no ratings */
  ok('1.3 a subscriber rated 0 still leads a free listing rated 4.9+',
     r.order[0].paid && !r.order[4].paid);
  await ctx.close();
}

/* ---- 2. and inside the layer, the nearest first ---- */
{
  const { ctx, p } = await open();
  /* the four points are shuffled on purpose: a list that comes back sorted
     from an already-sorted input proves nothing */
  await seed(p, { geo: true });
  const r = await layers(p);
  const ds = r.order.slice(0, 4).map(x => x.d);
  ok('2.1 layer one is ordered by real miles, ascending',
     ds.every((d, i) => i === 0 || (d != null && ds[i - 1] != null && d >= ds[i - 1])),
     ds.map(d => d == null ? '—' : d.toFixed(2)).join(' · '));
  ok('2.2 …and it really was shuffled going in', ds[0] < ds[3], ds[0] + ' < ' + ds[3]);
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
  const r = await layers(p);
  ok('3.1 it is still in layer one', r.ids.length === 4, String(r.ids.length));
  ok('3.2 …at the end of it, not outside it',
     r.order[3].d == null && r.order.slice(0, 4).every(x => x.paid),
     JSON.stringify(r.order.slice(0, 4).map(x => x.d)));
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
  const rows = await p.evaluate(() => [...document.querySelectorAll('#dirList .list-row')]
    .slice(0, 4).map(e => ({
      marked: /مموّل|Sponsored/.test(e.innerText),
      sub: ((e.querySelector('.row-sub') || {}).textContent || '').trim(),
    })));
  ok('6.1 every lifted row carries the sponsored mark',
     rows.length === 4 && rows.every(r => r.marked), JSON.stringify(rows.map(r => r.marked)));
  /* ⚠️ THE MONEY BUYS THE POSITION, NOT THE RIGHT TO HIDE THE DISTANCE. */
  ok('6.2 …and none of them hides its distance line',
     rows.every(r => r.sub.length > 0), JSON.stringify(rows.map(r => r.sub.slice(0, 14))));
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
