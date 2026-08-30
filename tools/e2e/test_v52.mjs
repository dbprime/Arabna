/* V.07.4 — صفّان مموّلان، والباقي بالمسافة.

   `330` gave layer one EVERY active subscription. Rai's decision of
   29 August bounds it to two rows: the paying shop gets a guaranteed
   place at the top of the screen, and the reader gets an honest
   directory from the third row down, where nothing is lifted for having
   paid.

   ⚠️ IT COST NOTHING TODAY AND WOULD HAVE COST A LOT LATER. Measured:
   one subscriber in each of the four categories that have any, and 138
   restaurants — so «every subscriber on top» and «two rows» are
   literally the same list right now. The difference appears the day a
   category fills, which is why the decision is taken while it is free.

   ⚠️ AND THE DANGEROUS HALF IS WHO GETS THE TWO ROWS WHEN TEN HAVE PAID.
   Without rotation, eight of them pay to be invisible. `rotate()` was
   already written and already proven — it served the sponsored band
   before `330` deleted it — and it turns on the VISIT key, so the rows
   do not move under the reader's finger and Back shows the same two.

   ⚠️ AND THE ROTATION TURNS INSIDE THE READER'S BUCKET, NEVER ACROSS IT.
   Handing `rotate` every subscriber at once let it wrap past the open
   ones and give both rows to closed shops while an open one was
   waiting — measured, two visits in four before the fix. That is the
   complaint this whole thread began with, shrunk into two rows. */
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';

const BASE = process.env.BASE || 'http://localhost:8099/index.html';
let pass = 0, fail = 0;
const ok = (n, c, extra = '') => { if (c) { pass++; console.log('PASS ' + n + (extra ? ' -> ' + extra : '')); }
  else { fail++; console.log('FAIL ' + n + (extra ? ' -> ' + extra : '')); } };

const H24 = Array(7).fill([['00:00', '24:00']]);
const SHUT = Array(7).fill(null);
const BASE_STATE = { lang: 'ar', showDemo: true,
                     location: { zip: '', city: 'Houston', state: 'TX' }, geo: null };

const browser = await chromium.launch();
const errors = [];
const open = async (seed, hash = '#/home') => {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  await ctx.addInitScript(s => {
    if (!localStorage.getItem('arabna.v1')) localStorage.setItem('arabna.v1', JSON.stringify(s));
  }, seed);
  const p = await ctx.newPage();
  p.on('pageerror', e => errors.push('PAGEERROR ' + e.message.slice(0, 120)));
  p.on('console', m => { if (m.type() === 'error' &&
    !/ERR_CONNECTION|ERR_CERT|ERR_TUNNEL|ERR_NAME|ERR_FAILED|fonts\.googleapis/.test(m.text()))
    errors.push(m.text().slice(0, 120)); });
  await p.goto(BASE + hash, { waitUntil: 'domcontentloaded' });
  await p.waitForTimeout(1300);
  return { ctx, p };
};
/* a NEW visit: the rotation is keyed to the history entry, so leaving and
   arriving again is what advances it */
const visit = async (p, hash) => {
  await p.evaluate(() => { location.hash = '#/home'; }); await p.waitForTimeout(380);
  await p.evaluate(h => { location.hash = h; }, hash); await p.waitForTimeout(1150);
};
const marked = p => p.evaluate(() => [...document.querySelectorAll('#dirList .list-row')]
  .filter(r => r.querySelector('.badge-sponsored')).map(r => r.dataset.route.split('/').pop()));
const listed = p => p.evaluate(() =>
  [...document.querySelectorAll('#dirList .list-row[data-route^="#/directory/"]')]
    .map(r => r.dataset.route.split('/').pop()));
const paidSeed = (ids, extra = {}) => {
  const e = {}; ids.forEach(id => { e[id] = Object.assign({ plan: 'paid' }, extra[id] || {}); });
  Object.keys(extra).forEach(id => { if (!e[id]) e[id] = extra[id]; });
  return e;
};

/* ============ 1 — a category with one subscriber does not move ======== */
/* ⚠️ THIS ONE COMES FIRST. The batch changes a model, and what is most to
   be feared of it is that it breaks the state it does not change at all. */
console.log('--- nothing moves where nothing should ---');
{
  const { ctx, p } = await open(BASE_STATE, '#/directory?cat=restaurants');
  const rows = await listed(p);
  const ad = await marked(p);
  const counts = await p.evaluate(async () => {
    const S = await import('arabna/js/store.js').catch(() => import('/js/store.js'));
    const paid = S.allBusinesses().filter(S.isPaid);
    const per = {}; paid.forEach(b => { per[b.cat] = (per[b.cat] || 0) + 1; });
    return { paid: paid.length, per, restaurants: S.allBusinesses().filter(b => b.cat === 'restaurants').length };
  });
  ok('1.1 the four categories that sell hold one subscriber each',
     Object.values(counts.per).every(n => n === 1), JSON.stringify(counts.per));
  ok('1.2 …so a category with one lifts exactly that one', ad.length === 1, ad.join(','));
  ok('1.3 …and it is still the first row', rows[0] === ad[0], rows[0] + ' / ' + ad[0]);
  ok('1.4 the category is big enough for this to matter later',
     counts.restaurants > 100, String(counts.restaurants));
  await ctx.close();
}

/* ============ 2 + 3 — five subscribers, two rows ============ */
console.log('--- two rows, and the rest by distance ---');
{
  const seed = Object.assign({}, BASE_STATE,
    { businessEdits: paidSeed(['b30', 'b31', 'b32', 'b33', 'b34']) });
  const { ctx, p } = await open(seed, '#/directory?cat=restaurants');
  const ad = await marked(p);
  const rows = await listed(p);
  const slots = await p.evaluate(async () => {
    const D = await import('arabna/js/data.js').catch(() => import('/js/data.js'));
    return D.AD_SLOTS.dirTop;
  });
  ok('2.1 the constant lives in data.js and says two', slots === 2, String(slots));
  ok('2.2 six subscribers, and exactly two rows are sold', ad.length === 2, ad.length + ' marked');
  ok('2.3 …and they are the first two', rows.slice(0, 2).join(',') === ad.join(','),
     rows.slice(0, 2).join(',') + ' vs ' + ad.join(','));
  /* ⚠️ from the third row down NOTHING is lifted for having paid — a
     subscriber may still stand there, but on its own merits and unmarked */
  const belowMarked = await p.evaluate(() =>
    [...document.querySelectorAll('#dirList .list-row[data-route^="#/directory/"]')]
      .slice(2).filter(r => r.querySelector('.badge-sponsored')).length);
  ok('3.1 no sponsored row from the third down', belowMarked === 0, String(belowMarked));
  /* ⚠️ the rows are CUT FROM the list, not added above it */
  const dupes = await p.evaluate(() => {
    const ids = [...document.querySelectorAll('#dirList [data-route^="#/directory/"]')]
      .map(e => e.dataset.route);
    return ids.length - new Set(ids).size;
  });
  ok('5.1 a subscriber appears once, never twice on one screen', dupes === 0, String(dupes));
  const total = await p.evaluate(() => +document.querySelector('#dirList').dataset.total || 0);
  ok('5.2 …and the count still adds up', total > 100, String(total));
  await ctx.close();
}

/* ============ 4 — Richmond: Katy before Houston ============ */
/* ⚠️ THE ITEM THAT OPENED THE FILE. «Katy is nearer than Houston — it
   should show me the nearer one, not the further, even if it pays.» */
console.log('--- the nearer one, even when the further one pays ---');
{
  const seed = Object.assign({}, BASE_STATE, {
    location: { zip: '', city: 'Richmond', state: 'TX' },
    geo: { lat: 29.5822, lng: -95.7607, at: Date.now() },
    businessEdits: { b39: { lat: 29.7858, lng: -95.8245 }, b1: { lat: 29.7604, lng: -95.3698 } },
  });
  const { ctx, p } = await open(seed, '#/directory?sort=nearest');
  const d = await p.evaluate(async () => {
    const S = await import('arabna/js/store.js').catch(() => import('/js/store.js'));
    const mi = id => { const v = S.distanceTo(S.businessById(id)); return v == null ? null : Math.round(v * 10) / 10; };
    const rows = [...document.querySelectorAll('#dirList .list-row[data-route^="#/directory/"]')]
      .map(r => r.dataset.route.split('/').pop());
    return { katy: mi('b39'), houston: mi('b1'), katyAt: rows.indexOf('b39') + 1, houstonAt: rows.indexOf('b1') + 1 };
  });
  ok('4.1 Katy is 14.6 miles and Houston 26.5', d.katy === 14.6 && d.houston === 26.5,
     d.katy + ' / ' + d.houston);
  /* ⚠️ THIS ITEM WAS WRITTEN WRONG FIRST TIME AND IS CORRECTED HERE, not
     softened. Rai's words — «it should show me the nearer one, not the
     further, even if it pays» — are answered by `337` FROM THE THIRD ROW
     DOWN, not at row one: the two top rows are the guaranteed place the
     $29 buys, and the file says so in as many words. Asserting that a
     payer never precedes a nearer free shop ANYWHERE would be asserting
     the opposite of the batch. What is promised, and what is measured:
     below the sold band, distance decides and nothing else. */
  ok('4.2 the sold band is two rows, and the nearest free shop starts right under it',
     d.katyAt === 3, 'Katy ' + d.katyAt + ' · Houston ' + d.houstonAt);
  const below = await p.evaluate(async () => {
    const S = await import('arabna/js/store.js').catch(() => import('/js/store.js'));
    const rows = [...document.querySelectorAll('#dirList .list-row[data-route^="#/directory/"]')]
      .slice(2).map(r => r.dataset.route.split('/').pop());
    const mi = id => S.distanceTo(S.businessById(id));
    const known = rows.map(mi).filter(v => v != null);
    return { ordered: known.every((v, i) => i === 0 || known[i - 1] <= v + 1e-9), n: known.length };
  });
  ok('4.3 …and from there down it really is nearest-first',
     below.ordered && below.n > 0, below.n + ' with a measured distance');
  await ctx.close();
}

/* ============ 6 + 7 — fair across visits, still within one ============ */
console.log('--- rotation: fair, and it does not move under the finger ---');
{
  const seed = Object.assign({}, BASE_STATE,
    { businessEdits: paidSeed(['b30', 'b31', 'b32', 'b33']) });
  const { ctx, p } = await open(seed, '#/directory?cat=restaurants');
  const seen = new Set();
  for (let v = 0; v < 6; v++) { await visit(p, '#/directory?cat=restaurants'); seen.add((await marked(p)).join(',')); }
  ok('6.1 a fresh visit gives another pair their turn', seen.size > 1,
     seen.size + ' different pairs: ' + [...seen].join(' | '));
  /* ⚠️ …and inside ONE visit they must not move: a list that changes
     between one glance and the next reads as a fault */
  await visit(p, '#/directory?cat=restaurants');
  const a = await marked(p);
  await p.evaluate(() => document.querySelector('#dirFilter').click()); await p.waitForTimeout(500);
  await p.keyboard.press('Escape'); await p.waitForTimeout(500);
  ok('7.1 they do not move inside one visit', (await marked(p)).join(',') === a.join(','), a.join(','));
  await p.evaluate(() => document.querySelector('#dirList .list-row').click());
  await p.waitForTimeout(800);
  await p.goBack(); await p.waitForTimeout(1000);
  ok('7.2 …and Back brings the same two', (await marked(p)).join(',') === a.join(','),
     a.join(',') + ' vs ' + (await marked(p)).join(','));
  await ctx.close();
}

/* ============ 8 — «مفتوح الآن»: an open subscriber takes the row ====== */
console.log('--- the bucket wins, the rotation turns inside it ---');
{
  const seed = Object.assign({}, BASE_STATE, { businessEdits: paidSeed(
    ['b30', 'b31', 'b32', 'b33'],
    { b30: { hours: H24 }, b31: { hours: SHUT }, b32: { hours: SHUT },
      b33: { hours: SHUT }, b1: { hours: SHUT } }) });
  let openTook = 0, closedOverOpen = 0;
  for (let v = 0; v < 4; v++) {
    const { ctx, p } = await open(seed, '#/directory?cat=restaurants&sort=open');
    const r = await p.evaluate(async () => {
      const S = await import('arabna/js/store.js').catch(() => import('/js/store.js'));
      const now = new Date(S.now());
      const ad = [...document.querySelectorAll('#dirList .list-row')]
        .filter(x => x.querySelector('.badge-sponsored')).map(x => x.dataset.route.split('/').pop());
      const isOpen = id => S.isOpenNow(S.businessById(id), now);
      /* ⚠️ `isOpen` takes an ID — handing it a record made every
         subscriber read as closed and the check measured nothing. */
      const openPaid = S.allBusinesses()
        .filter(b => S.isPaid(b) && b.cat === 'restaurants' && isOpen(b.id)).map(b => b.id);
      return { ad, adOpen: ad.filter(isOpen), openPaid };
    });
    /* an open subscriber exists, so it must hold a row every single time */
    if (r.openPaid.length && r.adOpen.length) openTook++;
    if (r.openPaid.some(id => !r.ad.includes(id)) && r.ad.length >= r.openPaid.length) closedOverOpen++;
    await ctx.close();
  }
  ok('8.1 the open subscriber takes a row on every visit', openTook === 4, openTook + '/4');
  ok('8.2 …and a closed one never takes it from them', closedOverOpen === 0, String(closedOverOpen));
}

/* ============ 9 — the filter is a filter, and the lift does not save === */
{
  const seed = Object.assign({}, BASE_STATE, { businessEdits: paidSeed(
    ['b30', 'b31', 'b32'], { b30: { hours: H24 }, b31: { hours: SHUT }, b32: { hours: SHUT } }) });
  const { ctx, p } = await open(seed, '#/directory?cat=restaurants&open=1');
  const shut = await p.evaluate(async () => {
    const S = await import('arabna/js/store.js').catch(() => import('/js/store.js'));
    const now = new Date(S.now());
    return [...document.querySelectorAll('#dirList .list-row[data-route^="#/directory/"]')]
      .map(r => r.dataset.route.split('/').pop())
      .filter(id => !S.isOpenNow(S.businessById(id), now)).length;
  });
  ok('9.1 «مفتوح الآن» as a FILTER leaves no closed row, sponsored included',
     shut === 0, String(shut));
  await ctx.close();
}

/* ============ 10 — outside the coverage nothing is sold ============ */
{
  const { ctx, p } = await open(Object.assign({}, BASE_STATE,
    { location: { zip: '', city: 'Dallas', state: 'TX' } }), '#/directory');
  ok('10.1 a reader outside Greater Houston is sold nothing',
     (await marked(p)).length === 0, String((await marked(p)).length));
  await ctx.close();
}

/* ============ 11 — what the $29 is sold as ============ */
{
  const { ctx, p } = await open(BASE_STATE, '#/subscribe');
  const txt = (await p.textContent('#app')).replace(/\s+/g, ' ');
  ok('11.1 the promise names the two rows', /الصفّين الأولين/.test(txt), '');
  /* ⚠️ «الصفّان الأولان» without «بالتناوب» is «always first», which is
     not what is delivered once a category holds more than two. A promise
     sold as something other than what is delivered is worse than not
     selling it. */
  ok('11.2 …and says they rotate', /بالتناوب/.test(txt), '');
  await ctx.close();
}

console.log(errors.length ? 'CONSOLE ERRORS: ' + errors.slice(0, 4).join(' | ') : 'no console errors');
ok('12.1 zero console errors across every screen touched', errors.length === 0, String(errors.length));

await browser.close();
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
