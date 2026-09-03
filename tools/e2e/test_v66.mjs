/* V.09.1 — ids that hold the day the server arrives.

   The owner's decision of 29 August: «everything is written on the
   assumption of a server, and the server is close — build whatever can be
   built that way now.» This is the piece that costs nothing today and
   costs a data migration afterwards.

   ⚠️ MEASURED ON THE RUNNING FILE, not argued: seventeen places in
   `js/store.js` minted a record id, and eleven carried no randomness at
   all — the whole id was the millisecond. Twenty thousand reviews minted
   in a loop came out as SIX distinct ids. Two devices minting a claim in
   the same millisecond produced the identical string. And the four that
   look safest were the worst: their suffix is a counter ON THE DEVICE,
   which starts at zero on every device and therefore guarantees the
   collision it appears to prevent.

   Nothing has ever seen it because the ids have never met: each device
   writes its own localStorage. On one shared table they are primary keys,
   and one person's review silently overwrites another's.

   ⚠️ THE TEETH ARE ITEM 2 AND ITEM 4, and without them this file is a
   green line: ANY test that mints two records a moment apart passes with
   the old code too, because the millisecond moved between them. So the
   clock is frozen, and the OLD expression is re-run under the same freeze
   and must collide. */
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import { readFileSync } from 'node:fs';

const BASE = process.env.BASE || 'http://localhost:8099/index.html';
const ROOT = new URL('../../', import.meta.url).pathname;
let pass = 0, fail = 0;
const ok = (n, c, extra = '') => { if (c) { pass++; console.log('PASS ' + n + (extra ? ' -> ' + extra : '')); }
  else { fail++; console.log('FAIL ' + n + (extra ? ' -> ' + extra : '')); } };

const browser = await chromium.launch();
async function open(seed = {}) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  await ctx.addInitScript((seed) => {
    const K = 'arabna.v1'; let s = {}; try { s = JSON.parse(localStorage.getItem(K) || '{}'); } catch (e) { /* */ }
    Object.assign(s, { lang: 'ar' }, seed);
    localStorage.setItem(K, JSON.stringify(s));
  }, seed);
  const page = await ctx.newPage();
  await page.route('**://fonts.g*/**', r => r.abort());
  await page.goto(BASE + '#/home', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(700);
  /* the app's OWN module instance — `arabna/…` is the importmap name on the
     single-file build, where a relative path would fetch a second copy */
  await page.evaluate(async () => {
    const load = async (rel, spec) => { try { return await import(spec); } catch (e) { return await import(rel); } };
    window.__S = await load('./js/store.js', 'arabna/js/store.js');
  });
  return { page, ctx };
}

/* ============ 1 · 2 · 4 — the maker itself ============ */
{
  const { page, ctx } = await open();
  const r = await page.evaluate(() => {
    const S = window.__S;
    const live = new Set();
    for (let i = 0; i < 10000; i++) live.add(S.mintId('r'));

    /* ⚠️ THE CLOCK IS FROZEN — this is the whole test. Everything below
       runs inside one millisecond, which is what a busy server looks like
       and what the old code could not survive. */
    const real = Date.now, T = 1788027624216;
    Date.now = () => T;
    const frozen = new Set();
    for (let i = 0; i < 20000; i++) frozen.add(S.mintId('r'));
    /* item 4 — the OLD expression, verbatim, under the same freeze. If this
       does NOT collide, the freeze is not working and items 1–3 prove
       nothing. */
    const oldWay = new Set();
    for (let i = 0; i < 20000; i++) oldWay.add('r' + Date.now());
    const oldClaimA = 'cl' + Date.now() + '-' + (0 + 1);   // device A, first claim
    const oldClaimB = 'cl' + Date.now() + '-' + (0 + 1);   // device B, first claim
    const newClaimA = S.mintId('cl'), newClaimB = S.mintId('cl');
    Date.now = real;
    return { live: live.size, frozen: frozen.size, oldWay: oldWay.size,
             oldSame: oldClaimA === oldClaimB, newSame: newClaimA === newClaimB,
             sample: newClaimA };
  });
  ok('1.1 ten thousand ids, one prefix, real clock — zero duplicates', r.live === 10000, String(r.live));
  ok('2.1 twenty thousand inside ONE frozen millisecond — zero duplicates', r.frozen === 20000, String(r.frozen));
  ok('4.1 …and the old expression under the same freeze collapses to one id',
     r.oldWay === 1, `${r.oldWay} distinct of 20000`);
  ok('3.1 two devices, same millisecond, first claim each — the old id is identical',
     r.oldSame === true, String(r.oldSame));
  ok('3.2 …and the new one is not', r.newSame === false, r.sample);
  await ctx.close();
}

/* ============ 5 · 6 — nothing already saved moves ============ */
{
  /* ⚠️ an id on somebody's device is a link they have shared —
     `#/marketplace/<id>` goes round WhatsApp. Re-numbering saved records
     breaks every one of them, so the new maker is for new records only. */
  const seed = {
    user: { email: 'a@b.c', emailVerified: true, tier: 2, name: 'x', phone: '7134669182', phoneVerified: true },
    extraClassifieds: [{ id: 'c1788000000000', catId: 'cars', title: { ar: 'سيّارة', en: 'Car' },
      desc: { ar: 'x', en: 'x' }, price: '1000', status: 'live', owner: 'me', at: 1788000000000 }],
    myListings: ['c1788000000000'],
    myAds: [{ id: 'ad1788000000000-0', product: 'slider', status: 'live' }],
    reviews: [{ id: 'r1788000000000', bizId: 'b30', rating: 5, text: 'x', mine: true }],
    claims: [{ id: 'cl1788000000000-1', bizId: 'b30', status: 'pending' }],
  };
  const { page, ctx } = await open(seed);
  const after = await page.evaluate(() => {
    const st = window.__S.state;
    return { ad: (st.myAds || []).map(a => a.id), rev: (st.reviews || []).map(r => r.id),
             cl: (st.claims || []).map(c => c.id), cls: (st.extraClassifieds || []).map(c => c.id) };
  });
  ok('5.1 every id saved before the batch is byte-identical after it',
     after.ad[0] === 'ad1788000000000-0' && after.rev[0] === 'r1788000000000'
     && after.cl[0] === 'cl1788000000000-1' && after.cls[0] === 'c1788000000000',
     [after.ad[0], after.rev[0], after.cl[0]].join(' · '));
  await page.evaluate(() => { location.hash = '#/marketplace/c1788000000000'; });
  await page.waitForTimeout(700);
  const opened = await page.evaluate(() => ({
    hash: location.hash, text: (document.querySelector('#app') || {}).innerText || '' }));
  ok('6.1 an old shared link still opens what it always opened',
     opened.hash === '#/marketplace/c1788000000000' && /سيّارة/.test(opened.text), opened.hash);
  await ctx.close();
}

/* ============ 7 — the yearly copy ============ */
/* ⚠️ THE SPEC SAID «spawnRepeat twice makes one copy — repeat.spawned
   prevents the second», and that is not where the guard is. Measured on
   the tree BEFORE this batch: two calls make two copies and neither
   returns null. What `repeat.spawned` governs is `dueRepeats`, which stops
   OFFERING the event to the admin once the year is stamped — and that is
   the only door `spawnRepeat` is reached through. So the guard is checked
   where it lives; making `spawnRepeat` refuse a second call would be a
   behaviour change, and this batch is about ids. */
{
  const { page, ctx } = await open();
  const r = await page.evaluate(() => {
    const S = window.__S;
    S.state.extraEvents = [{ id: 'ev-seed', title: { ar: 'مهرجان', en: 'Festival' },
      /* ⚠️ the anniversary has to be inside REPEAT_LEAD_DAYS for dueRepeats to
         offer it at all: last year's edition, ten days short of a year ago */
      type: 'festival', status: 'live',
      startsAt: new Date(S.now() - 355 * 86400000).toISOString(),
      endsAt: '', repeat: { kind: 'gregorian', spawned: [] } }];
    const before = S.dueRepeats(S.now()).length;
    const real = Date.now, T = 1788027624216;
    Date.now = () => T;                     // both copies inside one millisecond
    const a = S.spawnRepeat('ev-seed'), b = S.spawnRepeat('ev-seed');
    Date.now = real;
    const copies = S.state.extraEvents.filter(e => e.id !== 'ev-seed');
    return { before, after: S.dueRepeats(S.now()).length, ids: copies.map(c => c.id),
             drafts: copies.every(c => c.status === 'pending'), spawnedTwice: !!(a && b) };
  });
  ok('7.1 once a year is stamped, dueRepeats stops offering it — that is the guard',
     r.before === 1 && r.after === 0, `offered ${r.before} → ${r.after}`);
  ok('7.2 …and two copies made in the SAME millisecond no longer share an id',
     r.spawnedTwice && r.ids.length === 2 && r.ids[0] !== r.ids[1], r.ids.join(' · '));
  ok('7.3 …each is a draft, and the year is still readable at the end of its id',
     r.drafts && r.ids.every(i => /-\d{4}$/.test(i)), r.ids[0]);
  await ctx.close();
}

/* ============ 8 — one source of time in one record ============ */
{
  const { page, ctx } = await open();
  const r = await page.evaluate(() => {
    const S = window.__S;
    S.advanceClock(30);                                  // the admin test clock
    S.reportWorshipTime('b11', 'الجمعة 1:30');
    const rec = (S.state.worshipFixes || [])[0];
    const stamp = parseInt(String(rec.id).slice(2).split('-')[0], 36);
    return { gap: Math.abs(stamp - rec.when), offsetDays: Math.round(S.state.clockOffset / 86400000),
             wound: rec.when - Date.now() > 29 * 86400000 };
  });
  ok('8.1 a record minted with the clock wound forward carries ONE time',
     r.gap < 1000 && r.offsetDays === 30 && r.wound, `gap ${r.gap}ms · +${r.offsetDays}d`);
  await ctx.close();
}

/* ============ 9 · 10 — the shape number, and the version that is read ============ */
{
  const { page, ctx } = await open();
  const r = await page.evaluate(() => {
    const S = window.__S;
    S.state.lang = 'ar'; S.save();
    const raw = JSON.parse(localStorage.getItem('arabna.v1') || '{}');
    const back = JSON.parse(S.exportBackup());
    return { schema: raw.schema, type: typeof raw.schema, version: back.version, backSchema: back.schema };
  });
  ok('9.1 the storage carries a shape number, and it is a number',
     r.type === 'number' && r.schema >= 1, `schema ${r.schema} (${r.type})`);
  const APP = /APP_VERSION = '([^']+)'/.exec(readFileSync(ROOT + 'js/data.js', 'utf8'))[1];
  ok('10.1 a backup writes the version READ from data.js, never a second literal',
     r.version === APP && r.version !== 'V.02.1', `${r.version} vs ${APP}`);
  ok('10.2 …and the shape number travels with it', r.backSchema === r.schema);
  await ctx.close();
}

/* ============ the source itself ============ */
{
  const src = readFileSync(ROOT + 'js/store.js', 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');   // the code, never the prose about it
  const mints = (src.match(/mintId\(/g) || []).length - 1;            // minus the declaration
  const handmade = src.match(/['"][a-z_]{1,5}['"]\s*\+\s*(Date\.now\(\)|now\(\))/g) || [];
  ok('11.1 every id in the store is minted — and the count is read, not written',
     mints >= 17, `${mints} call sites`);
  ok('11.2 zero ids are still made out of the clock alone', handmade.length === 0, handmade.join(' '));
  ok('11.3 the time in an id comes from now(), which carries the test clock',
     /mintId\(prefix\)[\s\S]{0,200}now\(\)\.toString\(36\)/.test(src));
  ok('11.4 the randomness is the file\'s own randomSalt — no second source',
     /mintId\(prefix\)[\s\S]{0,200}randomSalt\(\)/.test(src) && !/Math\.random\(\)[\s\S]{0,40}id:/.test(src));
}

await browser.close();
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
