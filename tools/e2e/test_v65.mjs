/* V.09.0 — the upgrade card in the directory list is SEEN: one class, two
   quiet movements, and no motion for whoever asked for none.

   The owner, on his phone, between the rows of the directory: «بدّي هالمكان
   يكون مميّزاً عن باقي المدرَجين — فلاش أو لون، شي بيجذب». Measured before
   the batch: `upsellHtml()` drew the card with the same `list-row` class as
   every business and added `style="border-color:var(--line)"` — the only
   hand-written thing about it made it look MORE like its neighbours. The
   rows look alike because they are one kind (businesses); the card is not
   a business, it is an invitation to pay, fifth in the list on purpose —
   and if it does not differ to the eye the two kinds blur.

   ⚠️ Nothing here is a written colour. Every value is READ from computed
   styles — the card against the business row before it, the title against
   the token, the contrast from the gradient stops the browser resolved. */
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';

const BASE = process.env.BASE || 'http://localhost:8099/index.html';
let pass = 0, fail = 0;
const ok = (n, c, extra = '') => { if (c) { pass++; console.log('PASS ' + n + (extra ? ' -> ' + extra : '')); }
  else { fail++; console.log('FAIL ' + n + (extra ? ' -> ' + extra : '')); } };

const browser = await chromium.launch();
async function open(route, { lang = 'ar', scheme = 'dark', motion = 'no-preference' } = {}) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, colorScheme: scheme, reducedMotion: motion });
  await ctx.addInitScript(({ l }) => {
    const K = 'arabna.v1'; let s = {}; try { s = JSON.parse(localStorage.getItem(K) || '{}'); } catch (e) { /* */ }
    /* the theme is left on `auto` on purpose — V.06.0 clears a pinned theme
       at boot, so the DEVICE (emulated colorScheme) is what decides it */
    Object.assign(s, { lang: l, user: { email: 'a@b.c', emailVerified: true, tier: 1, name: 'x' } });
    localStorage.setItem(K, JSON.stringify(s));
  }, { l: lang });
  const page = await ctx.newPage();
  await page.route('**://fonts.g*/**', r => r.abort());
  await page.goto(BASE + route, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(900);
  return { page, ctx };
}

/* everything the checks read, in one pass over the live page */
const readCard = (page) => page.evaluate(() => {
  const rows = [...document.querySelectorAll('#dirList .list-row')];
  const cards = rows.filter(r => r.classList.contains('upsell-row'));
  const card = cards[0]; if (!card) return { count: 0, rows: rows.length };
  const idx = rows.indexOf(card); const prev = rows[idx - 1];
  const cs = (el, pseudo) => getComputedStyle(el, pseudo || null);
  const root = cs(document.documentElement);
  const tok = (n) => { const d = document.createElement('span'); d.style.color = `var(${n})`; document.body.appendChild(d);
    const v = cs(d).color; d.remove(); return v; };
  const title = card.querySelector('.row-title'), ptitle = prev && prev.querySelector('.row-title');
  const ico = card.querySelector('.row-ico');
  /* the opaque ground under the card: the first ancestor with a real background-color */
  let el = card.parentElement, ground = '';
  while (el) { const b = cs(el).backgroundColor; if (b && !/rgba\(0, 0, 0, 0\)|transparent/.test(b)) { ground = b; break; } el = el.parentElement; }
  const cr = card.getBoundingClientRect();
  const kids = [...card.querySelectorAll('*')].map(k => { const r = k.getBoundingClientRect(); return { l: r.left, t: r.top, r: r.right, b: r.bottom, w: r.width }; })
    .filter(k => k.w > 0);
  const out = kids.filter(k => k.l < cr.left - .5 || k.r > cr.right + .5 || k.t < cr.top - .5 || k.b > cr.bottom + .5).length;
  return {
    count: cards.length, rows: rows.length, idx,
    inlineStyle: card.getAttribute('style'),
    theme: document.documentElement.getAttribute('data-theme'),
    border: cs(card).borderColor, prevBorder: prev ? cs(prev).borderColor : '',
    bgImage: cs(card).backgroundImage, prevBgImage: prev ? cs(prev).backgroundImage : '',
    bgColor: cs(card).backgroundColor, ground,
    titleColor: title ? cs(title).color : '', prevTitleColor: ptitle ? cs(ptitle).color : '',
    goldBright: tok('--gold-bright'), text: tok('--text'), goldWash4: tok('--gold-wash-4'),
    afterAnim: cs(card, '::after').animationName, icoAnim: ico ? cs(ico).animationName : '',
    route: card.getAttribute('data-route'), outside: out, kids: kids.length,
  };
});

/* ---- contrast, computed from the colours the browser resolved ---- */
const rgba = (s) => { const m = /rgba?\(([\d.]+),\s*([\d.]+),\s*([\d.]+)(?:,\s*([\d.]+))?\)/.exec(s); return m ? [+m[1], +m[2], +m[3], m[4] === undefined ? 1 : +m[4]] : null; };
const over = (top, bg) => top.slice(0, 3).map((c, i) => c * top[3] + bg[i] * (1 - top[3]));
const lum = ([r, g, b]) => { const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); };
const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };
/* the card's ground at its worst: every gradient stop composited over the
   card's own colour and the opaque ground under it, and the LOWEST ratio
   of the title against any of them is the number that counts */
const minContrast = (c) => {
  const ground = rgba(c.ground) || [0, 0, 0, 1];
  const base = c.bgColor && rgba(c.bgColor) && rgba(c.bgColor)[3] > 0 ? over(rgba(c.bgColor), ground) : ground.slice(0, 3);
  const stops = [...c.bgImage.matchAll(/rgba?\([^)]*\)/g)].map(m => rgba(m[0])).filter(Boolean);
  const title = rgba(c.titleColor); if (!title || !stops.length) return 0;
  const grounds = stops.map(s => over(s, base));
  return Math.min(...grounds.map(g => ratio(title.slice(0, 3), g)));
};

/* ============ 1 · 2 · 3.1 · 5 · 6 — dark, motion allowed ============ */
let dark;
{
  const { page, ctx } = await open('#/directory');
  dark = await readCard(page);
  /* ⚠️ REVERSED BY 575, and this suite was NOT supposed to move — its batch
     file said 560's and 565's suites «measure the card's shape and its text,
     not its count or its position», and a red in either would mean something
     unrequested was broken. Measured, that claim was wrong about THIS line:
     it asserts both the count and the index. The rest of the file really is
     about look, and really did stay green.
     What survives is the half that belongs here: the card follows results
     rather than standing above them, and there IS one to measure the look
     of. Its count and spacing are v71's subject, derived there from the
     rows the page drew. */
  ok('1.1 the upgrade card follows results, and the first is the eleventh row',
     dark.count >= 1 && dark.rows > 10 && dark.idx === 10, `cards ${dark.count} · index ${dark.idx} of ${dark.rows}`);
  ok('1.2 no inline style on the card', dark.inlineStyle === null, String(dark.inlineStyle));
  /* ⚠️ «differs from the row» alone was measured to be TOOTHLESS: the rows
     carry --line-soft, so even the old inline var(--line) differed. The
     border has to BE the gold token — that is what the inline style broke. */
  ok('2.1 the card\'s border is the gold token, and differs from the business row before it',
     dark.border && dark.border === dark.goldWash4 && dark.border !== dark.prevBorder, `${dark.border} (token ${dark.goldWash4}) / row ${dark.prevBorder}`);
  ok('2.2 the card carries a gradient and the business row does not',
     /linear-gradient/.test(dark.bgImage) && !/linear-gradient/.test(dark.prevBgImage), dark.prevBgImage);
  ok('2.3 [dark] the title is --gold-bright, and the business row\'s title is not',
     dark.theme === 'dark' && dark.titleColor === dark.goldBright && dark.prevTitleColor !== dark.goldBright,
     `${dark.titleColor} vs token ${dark.goldBright} · row ${dark.prevTitleColor}`);
  ok('3.1 motion allowed: the sweep on ::after and the breath on the crown',
     dark.afterAnim === 'upsellSweep' && dark.icoAnim === 'upsellBreath', `${dark.afterAnim} / ${dark.icoAnim}`);
  const c = minContrast(dark);
  ok('4.2 [dark] the title clears 4.5 against the card\'s worst ground', c >= 4.5, c.toFixed(2));
  ok('6.1 nothing inside the card leaves its box', dark.outside === 0, `${dark.outside} of ${dark.kids} outside`);
  /* 5.1 — the tap still goes where it went */
  await page.click('#dirList .list-row.upsell-row');
  await page.waitForTimeout(500);
  ok('5.1 a tap on the card reaches #/subscribe', await page.evaluate(() => location.hash) === '#/subscribe' && dark.route === '#/subscribe');
  await ctx.close();
}

/* ============ 3.2 — reduced motion: still, and still gold ============ */
{
  const { page, ctx } = await open('#/directory', { motion: 'reduce' });
  const c = await readCard(page);
  ok('3.2 reduced motion: no animation on either — and the gold border stays',
     c.afterAnim === 'none' && c.icoAnim === 'none' && c.border !== c.prevBorder && c.border === dark.border,
     `${c.afterAnim} / ${c.icoAnim} · border ${c.border}`);
  await ctx.close();
}

/* ============ 2.3 · 4.1 — light ============ */
{
  const { page, ctx } = await open('#/directory', { scheme: 'light' });
  const c = await readCard(page);
  ok('2.3 [light] the title goes back to --text', c.theme === 'light' && c.titleColor === c.text, `${c.titleColor} vs ${c.text}`);
  const r = minContrast(c);
  ok('4.1 [light] the title clears 4.5 against the card\'s worst ground', r >= 4.5, r.toFixed(2));
  ok('2.1 [light] the border still differs from the row before it', c.border !== c.prevBorder, `${c.border} / ${c.prevBorder}`);
  await ctx.close();
}

/* ============ the English screen: same card, same place ============ */
{
  const { page, ctx } = await open('#/directory', { lang: 'en' });
  const c = await readCard(page);
  /* ⚠️ the same reversal — see 1.1 above */
  ok('1.1 [en] card present, eleventh, no inline style, gradient on', c.count >= 1 && c.idx === 10 && c.inlineStyle === null && /linear-gradient/.test(c.bgImage));
  await ctx.close();
}

/* 7.1 — run.sh runs this whole file against index-single-file.html as
   well; the build under test is named here so the two runs read apart */
console.log('build under test: ' + BASE);

await browser.close();
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
