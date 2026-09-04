/* V.09.3 — three findings from a full walk of the app: a pixel missing from
   the bottom bar, a guard that saw only half of what it guards, and nine
   links that turned people away without a word.

   The walk itself came back clean on five axes — zero console errors, zero
   failed requests, zero horizontal overflow, zero raw keys, zero empty
   screens — so these three are all of it.

   (1) THE BAR. Every tab measured 78 x 43 while the header's own buttons
   measured 44 x 44. The floor is a known rule, applied in the header and
   forgotten in the bar, and one pixel is not taste: 44pt is the minimum
   touch target in Apple's guidelines and App Store review measures it.
   This is the batch before the shell, so the moment is now.

   (2) THE GUARD. `wiring.mjs` matched `export function` alone, so a
   module-private function with no caller was invisible to it. That matters
   past one function: `168` computes its list from this tool, and it is the
   last file sent and the one whose whole job is the clearing up.

   (3) THE SILENT REDIRECT. Nine places bounced a reader to a list with no
   message. Someone opening a link sent on WhatsApp for a listing that has
   been removed lands in the directory with no idea why, and concludes the
   app is broken or the link was wrong.

   ⚠️ Nothing here is a written number where the app can be asked instead:
   the bar's own height is read from the live element, and the message is
   read from the pack rather than typed. */
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import { execFileSync } from 'node:child_process';

/* ⚠️ ROOT, never a relative path — run.sh runs from its own working
   directory, and a suite that reads a file by a relative path crashes
   there while passing by hand (measured in v67, one batch ago). */
const ROOT = new URL('../../', import.meta.url).pathname;
const BASE = process.env.BASE || 'http://localhost:8099/index.html';
const SINGLE = /index-single-file/.test(BASE);
let pass = 0, fail = 0;
const ok = (n, c, extra = '') => { if (c) { pass++; console.log('PASS ' + n + (extra ? ' -> ' + extra : '')); }
  else { fail++; console.log('FAIL ' + n + (extra ? ' -> ' + extra : '')); } };

const browser = await chromium.launch();
async function open(route, { lang = 'ar' } = {}) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  await ctx.addInitScript(({ l }) => {
    const K = 'arabna.v1'; let s = {};
    try { s = JSON.parse(localStorage.getItem(K) || '{}'); } catch (e) { /* */ }
    s.lang = l; s.showDemo = true; s.demoDefaultOff = true;
    s.user = { email: 'a@b.c', emailVerified: true, tier: 2, name: 'x' };
    localStorage.setItem(K, JSON.stringify(s));
  }, { l: lang });
  const page = await ctx.newPage();
  await page.route('**://fonts.g*/**', r => r.abort());
  await page.goto(BASE + route, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(900);
  return { page, ctx };
}

/* ---------------- 1) the bar clears the floor, and nothing else moved ------------- */
const FLOOR = 44;
for (const lang of ['ar', 'en']) {
  const { page, ctx } = await open('#/home', { lang });
  const m = await page.evaluate(() => {
    const box = el => { const r = el.getBoundingClientRect(); return { w: Math.round(r.width), h: Math.round(r.height) }; };
    const items = [...document.querySelectorAll('.bottom-nav .nav-item')].map(box);
    const bar = document.querySelector('.bottom-nav');
    const post = document.querySelector('.nav-post');
    const hdr = [...document.querySelectorAll('.app-header button')].map(box);
    return { items, bar: bar ? box(bar) : null, post: post ? box(post) : null, hdr };
  });

  const short = m.items.filter(i => i.h < FLOOR);
  ok(`1.1 [${lang}] every bottom-nav item clears the ${FLOOR}px floor`,
     m.items.length >= 5 && short.length === 0,
     m.items.map(i => i.h).join(' · '));

  /* a floor lifts the small and must not cut the large */
  const postItem = Math.max(...m.items.map(i => i.h));
  ok(`1.2 [${lang}] …and the tallest item (the add button) was not cut`,
     postItem >= 48, 'tallest=' + postItem);

  /* ⚠️ the bar's own height must not have grown — a floor of 44 inside a
     78px bar costs nothing, and that is the whole reason it is a floor and
     not a height. The number is READ from --nav-h, never written here. */
  const navH = await page.evaluate(() =>
    parseInt(getComputedStyle(document.documentElement).getPropertyValue('--nav-h'), 10));
  ok(`1.3 [${lang}] …and the bar itself is still exactly --nav-h`,
     m.bar && m.bar.h === navH, m.bar ? m.bar.h + ' vs --nav-h ' + navH : 'no bar');

  ok(`1.4 [${lang}] the header buttons are untouched at ${FLOOR}x${FLOOR}`,
     m.hdr.length >= 2 && m.hdr.every(b => b.w === FLOOR && b.h === FLOOR),
     m.hdr.map(b => b.w + 'x' + b.h).join(' · '));
  await ctx.close();
}

/* ---------------- 2) a link to something gone says so ---------------------------- */
/* the message is read from the pack, never typed here */
const { page: p0, ctx: c0 } = await open('#/home');
const GONE = await p0.evaluate(async () => {
  let I; try { I = await import('arabna/js/i18n.js'); } catch (e) { I = await import('./js/i18n.js'); }
  return { ar: I.STRINGS.ar.gone, en: I.STRINGS.en.gone };
});
await c0.close();

ok('2.0a the key exists in the Arabic pack', !!GONE.ar, GONE.ar || '');
ok('2.0b …and in the English pack', !!GONE.en, GONE.en || '');

/* every one of the four screens, each with its own destination */
const CASES = [
  ['#/directory/zzz-not-a-real-id',   '#/directory'],
  ['#/marketplace/zzz-not-a-real-id', '#/marketplace'],
  ['#/magazine/zzz-not-a-real-id',    '#/magazine'],
  ['#/events/zzz-not-a-real-id',      '#/events'],
];
for (const [route, dest] of CASES) {
  const { page, ctx } = await open(route);
  const seen = await page.evaluate(() => {
    const el = document.querySelector('.toast-root');
    return el ? (el.textContent || '').trim() : '';
  });
  const hash = await page.evaluate(() => location.hash);
  ok(`2.1 ${route} says why`, seen.includes(GONE.ar), seen || '(no toast)');
  ok(`2.2 …and lands on ${dest}, the destination unchanged`, hash === dest, hash);
  await ctx.close();
}

/* ⚠️ and the guard must not speak when nothing is wrong */
{
  const { page, ctx } = await open('#/directory/b30');
  const seen = await page.evaluate(() => {
    const el = document.querySelector('.toast-root');
    return el ? (el.textContent || '').trim() : '';
  });
  ok('2.3 a listing that exists raises no toast at all', seen === '', seen || 'silent');
  await ctx.close();
}

/* ---------------- 3) the guard sees the private ones too ------------------------- */
/* module-build only: the tool is a file on disk, not part of either build */
if (!SINGLE) {
  const out = execFileSync('node', [ROOT + 'tools/audit/wiring.mjs', ROOT], { encoding: 'utf8' });
  const line = (out.split('\n').find(l => /5b /.test(l)) || '').trim();
  ok('3.1 wiring.mjs reports check 5b at all', !!line, line);
  ok('3.2 …and it finds the private function the export loop could not see',
     /lockedBlock/.test(line), line);
  /* ⚠️ a note, not a failure: a check that is red every morning is read as
     switched off. `168` is what raises it, under its own two conditions. */
  ok('3.3 …as a NOTE, so the tool still exits clean', /^PASS/.test(line) && /note:/.test(line), line);
  ok('3.4 …and check 5 is still there beside it, not replaced',
     /PASS 5 no exported function is dead/.test(out));
} else {
  ok('3.1 (tool check, module build only)', true);
  ok('3.2 (tool check, module build only)', true);
  ok('3.3 (tool check, module build only)', true);
  ok('3.4 (tool check, module build only)', true);
}

console.log(`\n${pass} passed, ${fail} failed`);
await browser.close();
process.exit(fail ? 1 : 0);
