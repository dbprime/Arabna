/* V.08.9 — reviews are free for everyone, by decision and by code, and
   three texts were selling them with the subscription.

   The owner saw the upgrade card in the directory list on his own phone:
   «رقّي صفحة نشاطك — صور، فيديو، وتقييمات المستخدمين» — and asked whether
   reviews were not agreed to be free. They are: `planFreeNote` and `faqA2`
   say so, `PLAN_LIMITS` gates photos/videos/offers and nothing else, and
   the business page draws the reviews section and «اكتب تقييماً» for every
   listing with no plan condition. Three keys written before that decision
   were still promising the opposite — `upgradeBanner`, `lockedSub`,
   `subFeatures` — and two dead keys carried a «10 photos» that nothing in
   the code corresponds to (`PLAN_LIMITS.paid.photos` is `Infinity`).

   THE RULE: a text that says what the code does not do is corrected ON
   THE CODE, never the other way round — the code is what matches the
   decision.

   ⚠️ No number is written here. The 3 and the Infinity and the 3 videos
   are READ from `js/store.js`'s `PLAN_LIMITS`; if that table ever moves,
   2.2 and 2.3 go red on purpose. run.sh runs this file against BOTH
   builds, and block 5 additionally decodes the single-file build's
   inlined pack so a stale generated build cannot pass on the module one. */
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import { readFileSync, existsSync } from 'node:fs';

const BASE = process.env.BASE || 'http://localhost:8099/index.html';
const ROOT = new URL('../../', import.meta.url).pathname;
let pass = 0, fail = 0;
const ok = (n, c, extra = '') => { if (c) { pass++; console.log('PASS ' + n + (extra ? ' -> ' + extra : '')); }
  else { fail++; console.log('FAIL ' + n + (extra ? ' -> ' + extra : '')); } };

/* ---------- the packs and the limits, read from the source ---------- */
const i18n = readFileSync(ROOT + 'js/i18n.js', 'utf8');
const store = readFileSync(ROOT + 'js/store.js', 'utf8');
/* every value of a key, in file order: ar first, en second */
const vals = (src, key) => [...src.matchAll(new RegExp(`(?:^|[\\s,{])${key}\\s*:\\s*'((?:[^'\\\\]|\\\\.)*)'`, 'gm'))].map(m => m[1]);
const KEYS = ['upgradeBanner', 'lockedSub', 'subFeatures'];
const namesReviews = (s) => /تقييم/.test(s) || /review/i.test(s);
/* ⚠️ THE SPEC CONTRADICTED ITSELF HERE, and the measurement settled it.
   Its item 1.1 asked that none of the three keys contain «تقييم» — while
   its own wording for `lockedSub` reads «التقييمات وحتى 3 صور مفتوحة له مثل
   الجميع»: reviews NAMED, as free. The harm the item guards is a text
   that puts reviews in the subscription's column, so that is what is
   measured: a review word in the same sentence as the subscription. A
   sentence that says reviews are open to everyone is the batch's point,
   not its fault. `upgradeBanner` and `subFeatures` are entirely the
   subscription's column, so for them any review word is the fault. */
const sellsReviews = (s) => s.split(/[.!?؟]/).some(x => namesReviews(x) && /اشتراك|subscri|upgrade|رقّ/i.test(x));
const STRICT = { upgradeBanner: true, lockedSub: false, subFeatures: true };

/* PLAN_LIMITS — the table the texts must agree with */
const lim = /PLAN_LIMITS\s*=\s*\{([\s\S]*?)\n\};/.exec(store)[1];
const tier = (name) => { const m = new RegExp(name + '\\s*:\\s*\\{([^}]*)\\}').exec(lim)[1];
  const f = (k) => new RegExp(k + '\\s*:\\s*([A-Za-z0-9.]+)').exec(m)[1]; return { photos: f('photos'), videos: f('videos'), offers: f('offers') }; };
const FREE = tier('free'), PAID = tier('paid');

/* ============ 1 — the three keys, both packs ============ */
{
  for (const k of KEYS) {
    const v = vals(i18n, k);
    ok(`1.1 ${k} exists once per pack`, v.length === 2, String(v.length));
    const bad = STRICT[k] ? namesReviews : sellsReviews;
    ok(`1.1 ${k} never sells reviews (ar · en)`, v.length === 2 && !v.some(bad), v.join(' | '));
  }
  /* and the free-plan note has to SAY reviews are free — that is what replaced the sale */
  const ls = vals(i18n, 'lockedSub');
  ok('1.1b lockedSub names reviews as open to everyone', ls.length === 2 && ls.every(namesReviews)
     && /مثل الجميع/.test(ls[0]) && /like everyone/.test(ls[1]));
  const dead = ['photosLimit', 'videoLimit'].map(k => [k, vals(i18n, k)]);
  /* measured before the batch: zero readers in js/screens js/ui.js js/store.js index.html — so they are gone */
  ok('1.2 photosLimit and videoLimit are gone from both packs', dead.every(([, v]) => v.length === 0),
     dead.map(([k, v]) => `${k}:${v.length}`).join(' '));
}

/* ============ 2 — the numbers come from PLAN_LIMITS ============ */
{
  const sf = vals(i18n, 'subFeatures');
  ok('2.1 subFeatures says unlimited photos, and PLAN_LIMITS.paid.photos is Infinity',
     PAID.photos === 'Infinity' && /بلا حدّ/.test(sf[0] || '') && /Unlimited/.test(sf[1] || ''), `paid.photos=${PAID.photos}`);
  const ls = vals(i18n, 'lockedSub');
  const nums = (s) => s.match(/\d+/g) || [];
  ok(`2.2 lockedSub carries PLAN_LIMITS.free.photos (${FREE.photos}) and no other number`,
     ls.length === 2 && ls.every(s => nums(s).length >= 1 && nums(s).every(n => n === FREE.photos)),
     ls.map(s => nums(s).join(',') || '—').join(' | '));
  ok(`2.3 subFeatures carries PLAN_LIMITS.paid.videos (${PAID.videos})`,
     sf.length === 2 && sf.every(s => nums(s).includes(PAID.videos)), sf.map(s => nums(s).join(',')).join(' | '));
  ok('2.4 …and «offers» is promised only because PLAN_LIMITS.paid.offers is true',
     PAID.offers === 'true' && /عروض/.test(sf[0] || '') && /Offers/.test(sf[1] || ''));
}

/* ============ 3 · 4 — in the browser ============ */
const browser = await chromium.launch();
async function open(route, lang = 'ar', extra = {}) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  await ctx.addInitScript(({ l, extra }) => {
    const K = 'arabna.v1'; let s = {}; try { s = JSON.parse(localStorage.getItem(K) || '{}'); } catch (e) { /* */ }
    Object.assign(s, { lang: l, user: { email: 'a@b.c', emailVerified: true, tier: 1, name: 'x' } }, extra);
    localStorage.setItem(K, JSON.stringify(s));
  }, { l: lang, extra });
  const page = await ctx.newPage();
  await page.route('**://fonts.g*/**', r => r.abort());
  await page.goto(BASE + route, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(800);
  return { page, ctx };
}
/* a REAL free listing, chosen from the data and not written: the first
   non-demo record whose plan is free */
const FREE_ID = await (async () => {
  const { page, ctx } = await open('#/home');
  const id = await page.evaluate(async () => {
    const load = async (rel, spec) => { try { return await import(spec); } catch (e) { return await import(rel); } };
    const D = await load('./js/data.js', 'arabna/js/data.js');
    const b = D.BUSINESSES.find(x => x.plan === 'free' && !x.demo);
    return b ? b.id : '';
  });
  await ctx.close();
  return id;
})();
ok('3.0 a free, non-demo listing exists to measure on', !!FREE_ID, FREE_ID);

for (const lang of ['ar', 'en']) {
  /* 3.1 — a reader on the free listing's page: reviews and the write button, no lock */
  {
    const { page, ctx } = await open(`#/directory/${FREE_ID}`, lang);
    const r = await page.evaluate(() => {
      const btn = document.querySelector('#revBtn');
      const list = document.querySelector('#revList');
      const lockedNearReviews = !!(list && list.closest('.locked'));
      return { hasList: !!list, btn: btn ? btn.innerText.trim() : '', disabled: !!(btn && btn.disabled), lockedNearReviews,
        anyLock: document.querySelectorAll('.locked').length };
    });
    ok(`3.1 [${lang}] the free listing shows the reviews section and the write button, unlocked`,
       r.hasList && r.btn && !r.disabled && !r.lockedNearReviews && r.anyLock === 0, JSON.stringify(r));
    await ctx.close();
  }
  /* 3.2 — the upgrade card on the same page (drawn for its owner) names no reviews */
  {
    const { page, ctx } = await open(`#/directory/${FREE_ID}`, lang, { myBusinessIds: [FREE_ID] });
    const cards = await page.evaluate(() => [...document.querySelectorAll('.upsell')].map(e => e.innerText.replace(/\s+/g, ' ').trim()));
    ok(`3.2 [${lang}] the upgrade card on the business page is drawn for the owner and never says «reviews»`,
       cards.length >= 1 && !cards.some(namesReviews), cards.join(' | ') || 'no card');
    await ctx.close();
  }
  /* 4.1 — the card between the rows of the directory list */
  {
    const { page, ctx } = await open('#/directory', lang);
    const card = await page.evaluate(() => {
      const el = document.querySelector('#dirList .list-row[data-route="#/subscribe"]');
      return el ? el.innerText.replace(/\s+/g, ' ').trim() : '';
    });
    ok(`4.1 [${lang}] the directory's upgrade card between the rows never says «reviews»`,
       card.length > 0 && !namesReviews(card), card || 'no card');
    await ctx.close();
  }
}

/* ============ 5 — the single-file build carries the same pack ============ */
/* run.sh already runs this whole file against index-single-file.html; this
   block is the guard for the OTHER direction — a stale generated build
   passing while the module build is measured. The modules sit inlined as
   base64 data URLs behind the importmap, so the pack is DECODED, not
   grepped: a text search over that file finds nothing either way. */
{
  const one = ROOT + 'index-single-file.html';
  let same = false, detail = 'no single-file build';
  if (existsSync(one)) {
    const m = /"arabna\/js\/i18n\.js":\s*"data:text\/javascript;base64,([A-Za-z0-9+/=]+)"/.exec(readFileSync(one, 'utf8'));
    if (m) {
      const pack = Buffer.from(m[1], 'base64').toString('utf8');
      const a = KEYS.flatMap(k => vals(pack, k)), b = KEYS.flatMap(k => vals(i18n, k));
      same = a.length === b.length && a.every((v, i) => v === b[i]);
      detail = same ? `${a.length} values identical` : `single-file: ${a.join(' | ')}`;
    } else detail = 'i18n not found in the importmap';
  }
  ok('5.1 the single-file build inlines the same three keys, letter for letter', same, detail);
}

await browser.close();
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
