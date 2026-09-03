/* V.07.1 — five things the owner saw on his own phone.

   All five are interface, all five are local, and not one of them waits
   for the server.

   ⚠️ THE FIRST ONE IS THE CLASS, NOT THE BUTTON. «تعديل الملف الشخصي»
   sat outside its box on «حسابي» — and the cause is `.btn { height:
   52px }`: a fixed height does not grow when the label wraps, so the
   text spills out TOP AND BOTTOM at once, because `align-items: center`
   splits the overflow across both sides. The English screen is why it
   stayed hidden: «Edit profile» is short and fits, the Arabic is longer
   and falls out — so shortening the word would have hidden the fault
   until the next long one. `.btn` is on every screen in the app, which
   is why this batch runs the full net.

   ⚠️ AND THE FIFTH IS TWO HEADS, NOT ONE. The arrow between the tile and
   the label pushed a group head's text 34px further in than an ordinary
   row's — 294 against 328. «تصنيفات عربنا» stops folding altogether and
   becomes a section title with no arrow; «المساعدة والقوانين» keeps
   folding and its arrow moves to the END of the row, where it displaces
   nothing. */
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';

const BASE = process.env.BASE || 'http://localhost:8099/index.html';
let pass = 0, fail = 0;
const ok = (n, c, extra = '') => { if (c) { pass++; console.log('PASS ' + n + (extra ? ' -> ' + extra : '')); }
  else { fail++; console.log('FAIL ' + n + (extra ? ' -> ' + extra : '')); } };

const NOW = Date.now();
const LONG = 'سطر '.repeat(120);
const MEMBER = { name: 'أحمد سالم', email: 'a@b.c', emailVerified: true,
                 phone: '7134669182', phoneVerified: true, joined: NOW - 9e8 };
const SEED = {
  lang: 'ar', user: MEMBER,
  reviews: [
    { id: 'rL', bizId: 'b1', rating: 5, user: 'أحمد', when: { ar: 'اليوم', en: 'today' },
      text: { ar: LONG, en: 'line '.repeat(120) }, mine: true },
  ],
  myListings: ['c1'],
};

const browser = await chromium.launch();
const errors = [];
const wire = p => {
  p.on('pageerror', e => errors.push('PAGEERROR ' + e.message.slice(0, 120)));
  p.on('console', m => { if (m.type() === 'error' &&
    !/ERR_CONNECTION|ERR_CERT|ERR_TUNNEL|ERR_NAME|ERR_FAILED|fonts\.googleapis/.test(m.text()))
    errors.push(m.text().slice(0, 120)); });
};
/* ⚠️ THE INVENTED DATA IS ON FOR THIS SUITE, and it is merged in HERE —
   at the single door every state passes through — rather than into one
   seed object. Half this suite opens with its own small state (`{ lang,
   user }` for the drawer block), so a flag written into `SEED` alone
   reaches only half the tests.
   ⚠️ And it does not come from the shared helper: the guard below seeds
   only when the key is ABSENT, and a helper that creates the key first
   would skip the whole fixture.
   ⚠️ `demoDefaultOff` is the half that is easy to miss — without it the
   boot migration turns `showDemo` straight back off.
   `b1`, its long review, and the subscribed business behind «إعلانات
   مميّزة» are all invented records, and all three are this suite's
   fixture. */
const DEMO_ON = { showDemo: true, demoDefaultOff: true };
const open = async (state, hash = '#/home') => {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  await ctx.addInitScript(s => {
    if (!localStorage.getItem('arabna.v1')) localStorage.setItem('arabna.v1', JSON.stringify(s));
  }, Object.assign({}, DEMO_ON, state));
  const p = await ctx.newPage(); wire(p);
  await p.goto(BASE + hash, { waitUntil: 'domcontentloaded' });
  await p.waitForTimeout(1200);
  return { ctx, p };
};
const go = async (p, h) => { await p.evaluate(x => { location.hash = x; }, h); await p.waitForTimeout(900); };
/* ⚠️ NO `eval` — the project bans it in `tools/e2e` and `script-src 'self'`
   refuses it on the module build. The measurement is written inline in the
   page function instead of being shipped as a source string. */

/* ============ 1 — a button grows with its label ============ */
console.log('--- the button is the class, not the word ---');
{
  const { ctx, p } = await open(SEED);
  const m = await p.evaluate(() => {
    const wrap = document.createElement('div');
    wrap.style.cssText = 'width:177px;position:fixed;top:0;left:0;z-index:-1';
    wrap.innerHTML = '<button class="btn btn-sm" id="tLong">تعديل الملف الشخصي الطويل جدا</button>'
                   + '<button class="btn btn-sm" id="tSm">حفظ</button>'
                   + '<button class="btn" id="tBig">حفظ</button>';
    document.body.appendChild(wrap);
    const box = (el) => el.getBoundingClientRect();
    /* does the text really sit inside its own box, top and bottom? */
    const inside = (el) => { const b = box(el);
      const r = document.createRange(); r.selectNodeContents(el);
      const t = r.getBoundingClientRect();
      return t.top >= b.top - 0.5 && t.bottom <= b.bottom + 0.5; };
    const long = document.querySelector('#tLong');
    const r = { longH: Math.round(box(long).height), longInside: inside(long),
                smH: Math.round(box(document.querySelector('#tSm')).height),
                bigH: Math.round(box(document.querySelector('#tBig')).height) };
    wrap.remove(); return r;
  });
  ok('1.1 a two-line label makes the box grow', m.longH > 40, String(m.longH));
  ok('1.2 …and not a letter of it falls outside', m.longInside);
  ok('1.3 a one-line .btn-sm is unchanged at 40', m.smH === 40, String(m.smH));
  ok('1.4 …and a one-line .btn is unchanged at 52', m.bigH === 52, String(m.bigH));
  /* the real screen the owner photographed */
  await go(p, '#/profile');
  const real = await p.evaluate(() => [...document.querySelectorAll('.btn, .btn-sm')].every(el => {
    const b = el.getBoundingClientRect();
    const r = document.createRange(); r.selectNodeContents(el);
    const t = r.getBoundingClientRect();
    return t.height === 0 || (t.top >= b.top - 0.5 && t.bottom <= b.bottom + 0.5);
  }));
  ok('1.5 …and on «حسابي» itself no button label escapes its box', real);
  await ctx.close();
}

/* ============ 2 — a long review is clamped, a short one is not ======== */
console.log('--- the review does not eat the screen ---');
{
  const { ctx, p } = await open(SEED, '#/directory/b1');
  await go(p, '#/directory/b1');
  const before = await p.evaluate(() => {
    const x = document.querySelector('.rv-text');
    return { clamped: x.classList.contains('clamped'), h: Math.round(x.getBoundingClientRect().height),
             label: x.nextElementSibling && x.nextElementSibling.classList.contains('rv-more')
                    ? x.nextElementSibling.textContent.trim() : null };
  });
  ok('2.1 an eight-line review is cut to two', before.clamped && before.h < 60, String(before.h));
  ok('2.2 …with «اقرأ المزيد» under it', before.label === 'اقرأ المزيد', String(before.label));
  await p.click('.rv-more'); await p.waitForTimeout(350);
  const after = await p.evaluate(() => {
    const x = document.querySelector('.rv-text');
    return { clamped: x.classList.contains('clamped'), h: Math.round(x.getBoundingClientRect().height),
             label: x.nextElementSibling.textContent.trim() };
  });
  ok('2.3 tapping opens it whole', !after.clamped && after.h > before.h * 3, String(after.h));
  ok('2.4 …and the button becomes «اقرأ أقل»', after.label === 'اقرأ أقل', after.label);

  /* ⚠️ a short review gets NO button at all: one that opens two lines
     onto two lines is a small lie */
  const short = await p.evaluate(() => {
    const x = [...document.querySelectorAll('.rv-text')].find(e => e.textContent.trim().length < 40);
    return x ? { clamped: x.classList.contains('clamped'),
                 btn: !!(x.nextElementSibling && x.nextElementSibling.classList.contains('rv-more')) } : null;
  });
  ok('2.5 a two-line review is not clamped and gets no button',
     short && !short.clamped && !short.btn, JSON.stringify(short));
  /* ⚠️ and the open/shut state is the PAGE's, not the store's */
  ok('2.6 nothing about it is written to storage',
     !/rv|clamp|readMore/i.test(await p.evaluate(() => localStorage.getItem('arabna.v1') || '')));
  await ctx.close();
}

/* ============ 3 — the eye stops meaning three things ============ */
console.log('--- one glyph, one meaning ---');
{
  const { ctx, p } = await open(SEED, '#/my-reviews');
  await go(p, '#/my-reviews');
  const rv = await p.evaluate(() => {
    const row = document.querySelector('.card .row-actions');
    return { buttons: row ? [...row.querySelectorAll('button')].map(b => b.textContent.replace(/\s+/g, ' ').trim()) : [],
             stray: !!document.querySelector('.row-between .mini-btn'),
             hasBuilding: !!(row && row.querySelector('button svg')) };
  });
  ok('3.1 «تقييماتي» offers «صفحة المحل» as a named button',
     rv.buttons.some(b => /صفحة المحل/.test(b)), rv.buttons.join(' · '));
  ok('3.2 …in the button row, not alone above the card',
     rv.buttons.length === 3 && !rv.stray, String(rv.buttons.length));
  ok('3.3 …and it carries an icon, so it is not a bare word', rv.hasBuilding);

  await go(p, '#/my-ads');
  const ad = await p.evaluate(() => {
    const row = document.querySelector('.row-actions');
    return row ? [...row.querySelectorAll('button')]
      .map(b => (b.textContent.replace(/\s+/g, ' ').trim() || b.getAttribute('aria-label') || '')) : [];
  });
  ok('3.4 «إعلاناتي» offers «افتح الإعلان»', ad.some(b => /افتح الإعلان/.test(b)), ad.join(' · '));
  /* ⚠️ the OTHER eye — «أخفِ / أعِد نشر» — is correct and is not touched.
     Two eyes in one row meaning two things was the fault, not the icon. */
  ok('3.5 …and the hide/republish eye is still there, untouched',
     ad.some(b => /أخفِ|أعِد نشر/.test(b)), ad.join(' · '));
  ok('3.6 no button in either row is a bare unlabelled icon',
     ad.every(b => b.length > 0), ad.join(' · '));
  await ctx.close();
}

/* ============ 4 — the tier leaves the drawer, not the gate ============ */
console.log('--- the drawer line ---');
{
  const { ctx, p } = await open(SEED);
  await p.click('#hMenu'); await p.waitForTimeout(600);
  const line = (await p.textContent('.drawer-user')).trim();
  ok('4.1 the drawer line is the email alone', line === 'a@b.c', line);
  ok('4.2 …with no tier written beside it', !/موثق|مؤكد|·/.test(line), line);
  /* ⚠️ AND THE GATE IS UNTOUCHED. `tier()` governs posting, messaging,
     claiming and buying an advertisement. What left is a line that was
     displayed, never a condition that governs. */
  const t = await p.evaluate(async () => {
    const S = await import('arabna/js/store.js').catch(() => import('./js/store.js'));
    return S.tier();
  });
  ok('4.3 …and tier() still answers 2 for a verified number', t === 2, String(t));
  await ctx.close();
}

/* ============ 5 — two heads, and the arrow that displaced the text ==== */
/* ⚠️ REWRITTEN in V.07.3, and the correction is the owner's. `345 · 5` said
   «تصنيفات عربنا» becomes a section title that is always open; he had
   said «take the arrow off, and when somebody taps categories it opens».
   The folding was never in question — and building it as written cost the
   one rule the drawer had kept through every batch: measured, 1049/844
   for a visitor with nothing touched.
   ⚠️ The item's REAL subject survives untouched: the arrow displaced a
   head's label by 34px, and taking it out of both heads fixed that on its
   own. That is what is measured here — plus the rule that was nearly
   lost. */
console.log('--- the drawer heads ---');
for (const [who, user] of [['member', MEMBER], ['visitor', null]]) {
  const { ctx, p } = await open({ lang: 'ar', user });
  await p.click('#hMenu'); await p.waitForTimeout(700);
  const d = await p.evaluate(() => {
    /* the LABEL is the LAST span in the row — the first is the coloured
       tile, and measuring that proves nothing at all */
    const lbl = (el) => {
      const ss = [...el.querySelectorAll(':scope > span')];
      const sp = ss[ss.length - 1];
      const r = document.createRange(); r.selectNodeContents(sp);
      const b = r.getBoundingClientRect();
      return { text: sp.textContent.trim(), start: Math.round(b.right) };
    };
    const heads = [...document.querySelectorAll('#drawer .dr-head')];
    const plain = document.querySelector('.dr-item[data-route]');
    const pan = document.querySelector('.drawer-panel');
    return { plain: lbl(plain), heads: heads.map(lbl), headCount: heads.length,
             realButtons: heads.every(h => h.tagName === 'BUTTON'
               && h.hasAttribute('data-toggle') && h.hasAttribute('aria-expanded')),
             arrows: document.querySelectorAll('#drawer .grp-arrow').length,
             titles: document.querySelectorAll('#drawer .dr-title').length,
             openGroups: document.querySelectorAll('#drawer .dr-group.open').length,
             foldedH: Math.round(pan.scrollHeight), viewH: Math.round(pan.clientHeight) };
  });
  /* ⚠️ THE MEASUREMENT OF THE BATCH: all three labels start in the same
     place. A head's used to start 34px further in — 294 against 328. */
  ok(`5.1 ${who}: an ordinary row's label starts at 328`, d.plain.start === 328, String(d.plain.start));
  ok(`5.2 ${who}: both group heads start at the same place`,
     d.headCount === 2 && d.heads.every(h => h.start === d.plain.start),
     d.heads.map(h => h.start).join(' · ') + ' vs ' + d.plain.start);
  ok(`5.3 ${who}: no head carries an arrow any more`, d.arrows === 0, d.arrows + ' arrows');
  /* ⚠️ …and what was removed is a DRAWING, not a behaviour: both heads are
     still real controls, reached by keyboard and announced as expanded or
     collapsed. */
  ok(`5.4 ${who}: …and both are still buttons that fold`, d.realButtons);
  ok(`5.5 ${who}: nothing became an always-open title`, d.titles === 0, String(d.titles));
  ok(`5.6 ${who}: both start folded`, d.openGroups === 0, d.openGroups + ' open');
  /* ⚠️ AND THE RULE THAT `345` COST AND THIS RESTORES: folded, the drawer
     does not scroll. It is 844/844 for both roles again. */
  ok(`5.7 ${who}: folded, the drawer does not scroll`, d.foldedH <= d.viewH + 1,
     d.foldedH + ' / ' + d.viewH);

  await p.click('#drawer [data-toggle="sections"]'); await p.waitForTimeout(500);
  const after = await p.evaluate(() => ({
    opened: !!document.querySelector('.dr-group[data-group="sections"].open'),
    rows: document.querySelectorAll('.dr-group[data-group="sections"] .dr-item[data-route]').length,
  }));
  ok(`5.8 ${who}: tapping the head opens it — the whole of what the owner asked`, after.opened);
  ok(`5.9 ${who}: …onto its six leaves`, after.rows === 6, String(after.rows));
  await p.click('#drawer [data-toggle="help"]'); await p.waitForTimeout(500);
  ok(`5.10 ${who}: and one group is open at a time`,
     await p.evaluate(() => document.querySelectorAll('#drawer .dr-group.open').length) === 1);
  await ctx.close();
}

console.log(errors.length ? 'CONSOLE ERRORS: ' + errors.slice(0, 4).join(' | ') : 'no console errors');
ok('6.1 zero console errors across every screen touched', errors.length === 0, String(errors.length));

await browser.close();
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
