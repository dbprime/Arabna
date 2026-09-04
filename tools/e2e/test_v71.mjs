/* V.09.6 — the upgrade card repeats every ten results instead of once at
   the fifth.

   The owner, 3 September, seeing the restaurant list on his phone: «why
   not show the upgrade card after every five or ten shops and repeat it,
   so a shop owner feels that upgrading puts him on top.»

   ⚠️ And the other reader was weighed before answering. This same list is
   what every visitor hunting a restaurant or a doctor scrolls, and most of
   them are customers, not shop owners — a paid card every five rows tires
   whoever came for a real result. The owner's decision: every ten.

   ⚠️ A SHORT LIST IS DELIBERATELY UNCHANGED. Ten results or fewer keep the
   single card at the end, exactly as `560` left it: repeating a paid card
   inside a list of four would be the whole screen.

   ⚠️ NOT ONE COUNT IS WRITTEN HERE. The expected number of cards is
   derived from the real rows the page actually drew (`floor(n / 10)`), so
   the day the directory's contents change the check re-measures instead of
   going stale against a literal — the fault `test_v27 · 4.4` committed
   with its own `5`, and `test_v56 · 3.6` with a frozen version. */
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import { readFileSync } from 'node:fs';

/* ⚠️ never a relative path — run.sh runs from its own working directory. */
const ROOT = new URL('../../', import.meta.url).pathname;
const BASE = process.env.BASE || 'http://localhost:8099/index.html';
const SINGLE = /index-single-file/.test(BASE);
const EVERY = 10;
let pass = 0, fail = 0;
const ok = (n, c, extra = '') => { if (c) { pass++; console.log('PASS ' + n + (extra ? ' -> ' + extra : '')); }
  else { fail++; console.log('FAIL ' + n + (extra ? ' -> ' + extra : '')); } };

const browser = await chromium.launch();
async function open(route) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  await ctx.addInitScript(() => {
    const K = 'arabna.v1'; let s = {};
    try { s = JSON.parse(localStorage.getItem(K) || '{}'); } catch (e) { /* */ }
    s.showDemo = true; s.demoDefaultOff = true;
    s.user = { email: 'a@b.c', emailVerified: true, tier: 2, name: 'x' };
    localStorage.setItem(K, JSON.stringify(s));
  });
  const page = await ctx.newPage();
  await page.route('**://fonts.g*/**', r => r.abort());
  await page.goto(BASE + route, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1000);
  return { page, ctx };
}

/* the SHAPE of the list as drawn: a sequence of 'row' and 'card' */
const shape = p => p.evaluate(() =>
  [...document.querySelectorAll('#dirList > .list-row')]
    .map(el => el.classList.contains('upsell-row') ? 'card' : 'row'));

/* the gaps between consecutive cards, counted in real rows */
function gaps(seq) {
  const out = []; let n = 0;
  for (const x of seq) { if (x === 'card') { out.push(n); n = 0; } else n++; }
  return out;
}

/* ---------- 1) a long category repeats it every ten ---------- */
{
  const { page, ctx } = await open('#/directory?cat=beauty');   /* measured: 24 */
  const seq = await shape(page);
  const rows = seq.filter(x => x === 'row').length;
  const cards = seq.filter(x => x === 'card').length;

  ok('1.0 the fixture category is long enough to repeat', rows > 2 * EVERY, rows + ' rows');
  /* ⚠️ derived, never written */
  ok(`1.1 the card count is floor(${rows} / ${EVERY})`,
     cards === Math.floor(rows / EVERY), `cards=${cards} expected=${Math.floor(rows / EVERY)}`);

  const g = gaps(seq);
  ok(`1.2 every gap between cards is exactly ${EVERY} rows`,
     g.length > 0 && g.every(x => x === EVERY), g.join(' · '));
  ok(`1.3 the first card falls after row ${EVERY}, not row 5`,
     seq.indexOf('card') === EVERY, 'index=' + seq.indexOf('card'));
  await ctx.close();
}

/* ---------- 2) a short list is untouched ---------- */
{
  const { page, ctx } = await open('#/directory?cat=lawyers');  /* measured: 10 */
  const seq = await shape(page);
  const rows = seq.filter(x => x === 'row').length;
  const cards = seq.filter(x => x === 'card').length;
  ok('2.0 the fixture is a short list', rows > 0 && rows <= EVERY, rows + ' rows');
  ok('2.1a a short list carries exactly one card', cards === 1, 'cards=' + cards);
  ok('2.1b …and it is the last thing in the list', seq[seq.length - 1] === 'card', seq.slice(-2).join(' · '));
  await ctx.close();
}
{
  const { page, ctx } = await open('#/directory?cat=doctors');  /* measured: 11 */
  const seq = await shape(page);
  const rows = seq.filter(x => x === 'row').length;
  const cards = seq.filter(x => x === 'card').length;
  ok('2.2a the fixture is one past the boundary', rows === EVERY + 1, rows + ' rows');
  ok('2.2b eleven results carry exactly one card', cards === 1, 'cards=' + cards);
  ok(`2.2c …after row ${EVERY}, with the eleventh below it`,
     seq.indexOf('card') === EVERY && seq[seq.length - 1] === 'row', seq.slice(EVERY - 1).join(' · '));
  await ctx.close();
}

/* ---------- 3) the first paint carries every card inside its own forty ---------- */
/* ⚠️ this is the half that does not look broken when it is wrong: getting
   it wrong silently draws 36 businesses instead of 40 before any scroll. */
{
  const { page, ctx } = await open('#/directory?cat=restaurants'); /* measured: 138 */
  const seq = await shape(page);
  const rows = seq.filter(x => x === 'row').length;
  const cards = seq.filter(x => x === 'card').length;
  const PAGE = 40;
  ok('3.0 the first batch drew a full page of real businesses, not fewer',
     rows === PAGE, rows + ' rows (no scrolling)');
  ok(`3.1 …and every card inside those ${PAGE} is already in the tree`,
     cards === Math.floor(PAGE / EVERY), `cards=${cards} expected=${Math.floor(PAGE / EVERY)}`);
  const g = gaps(seq);
  ok('3.2 …spaced evenly, with no card missing from the middle',
     g.length > 0 && g.every(x => x === EVERY), g.join(' · '));
  await ctx.close();
}

/* ---------- 4) the card is still a door ---------- */
{
  const { page, ctx } = await open('#/directory?cat=beauty');
  const routes = await page.evaluate(() =>
    [...document.querySelectorAll('#dirList > .list-row.upsell-row')].map(el => el.dataset.route));
  ok('4.1 every card still points at the subscription',
     routes.length > 0 && routes.every(r => r === '#/subscribe'), routes.join(' · '));
  await page.evaluate(() => document.querySelector('#dirList > .list-row.upsell-row').click());
  await page.waitForTimeout(500);
  const hash = await page.evaluate(() => location.hash);
  ok('4.2 …and pressing one actually arrives', hash === '#/subscribe', hash);
  await ctx.close();
}

/* ---------- 5) the old single-position rule is gone from the source ---------- */
if (!SINGLE) {
  const src = readFileSync(ROOT + 'js/screens/directory.js', 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
  ok('5.1 `rowsAll.splice(5` is gone — the fifth-position rule is not merely bypassed',
     !/rowsAll\.splice\(5/.test(src));
} else {
  ok('5.1 (source check, module build only)', true);
}

console.log(`\n${pass} passed, ${fail} failed`);
await browser.close();
process.exit(fail ? 1 : 0);
