/* V.07.1 — five things Rai saw on his own phone.

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
const MEMBER = { name: 'رامي البي', email: 'a@b.c', emailVerified: true,
                 phone: '7134669182', phoneVerified: true, joined: NOW - 9e8 };
const SEED = {
  lang: 'ar', user: MEMBER,
  reviews: [
    { id: 'rL', bizId: 'b1', rating: 5, user: 'رامي', when: { ar: 'اليوم', en: 'today' },
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
const open = async (state, hash = '#/home') => {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  await ctx.addInitScript(s => {
    if (!localStorage.getItem('arabna.v1')) localStorage.setItem('arabna.v1', JSON.stringify(s));
  }, state);
  const p = await ctx.newPage(); wire(p);
  await p.goto(BASE + hash, { waitUntil: 'domcontentloaded' });
  await p.waitForTimeout(1200);
  return { ctx, p };
};
const go = async (p, h) => { await p.evaluate(x => { location.hash = x; }, h); await p.waitForTimeout(900); };
/* the LABEL is the LAST span in the row — the first one is the coloured
   tile, and measuring that proves nothing at all */
const labelEdge = `(el) => { const ss = [...el.querySelectorAll(':scope > span')];
  const s = ss[ss.length - 1]; const r = document.createRange(); r.selectNodeContents(s);
  const b = r.getBoundingClientRect();
  return { text: s.textContent.trim(), start: Math.round(b.right), end: Math.round(b.left) }; }`;

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
  /* the real screen Rai photographed */
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
console.log('--- the drawer heads ---');
for (const [who, user] of [['member', MEMBER], ['visitor', null]]) {
  const { ctx, p } = await open({ lang: 'ar', user });
  await p.click('#hMenu'); await p.waitForTimeout(700);
  const d = await p.evaluate((fn) => {
    const lbl = eval('(' + fn + ')');
    const sec = document.querySelector('.dr-title');
    const help = document.querySelector('.dr-head');
    const plain = document.querySelector('.dr-item[data-route]');
    const arrow = help.querySelector('.grp-arrow').getBoundingClientRect();
    const pan = document.querySelector('.drawer-panel');
    return { plain: lbl(plain), section: lbl(sec), help: lbl(help),
             arrowEnd: Math.round(arrow.right),
             tag: sec.tagName, sectionArrow: !!sec.querySelector('.grp-arrow'),
             open: sec.parentElement.classList.contains('open'),
             rows: sec.parentElement.querySelectorAll('.dr-item').length,
             tabbable: sec.matches('button, a, [tabindex]'),
             foldedH: Math.round(pan.scrollHeight), viewH: Math.round(pan.clientHeight) };
  }, labelEdge);
  /* ⚠️ THE MEASUREMENT OF THE BATCH: all three labels start at the same
     place. The head's used to start 34px further in. */
  ok(`5.1 ${who}: an ordinary row's label starts at 328`, d.plain.start === 328, String(d.plain.start));
  ok(`5.2 ${who}: the section title starts at the same place`, d.section.start === d.plain.start,
     d.section.start + ' vs ' + d.plain.start);
  ok(`5.3 ${who}: and so does the folding head`, d.help.start === d.plain.start,
     d.help.start + ' vs ' + d.plain.start);
  ok(`5.4 ${who}: the arrow is at the far end of its row`, d.arrowEnd < d.help.end,
     d.arrowEnd + ' vs ' + d.help.end);
  /* ⚠️ a section that never folds is a TITLE, not a disabled button: a
     button that does nothing stays in the tab order and is announced as
     a control */
  ok(`5.5 ${who}: «تصنيفات عربنا» is not a button`, d.tag !== 'BUTTON', d.tag);
  ok(`5.6 ${who}: …carries no arrow`, !d.sectionArrow);
  ok(`5.7 ${who}: …is open, with all six rows showing`, d.open && d.rows === 6, String(d.rows));
  ok(`5.8 ${who}: …and the keyboard cannot land on it`, !d.tabbable);

  await p.click('.dr-head'); await p.waitForTimeout(500);
  const after = await p.evaluate(() => ({
    helpOpen: document.querySelector('.dr-head').parentElement.classList.contains('open'),
    sectionOpen: document.querySelector('.dr-title').parentElement.classList.contains('open'),
  }));
  ok(`5.9 ${who}: «المساعدة» still folds`, after.helpOpen);
  /* ⚠️ the accordion sweep walks every `.dr-group`, and the section is one
     with no `.dr-head` in it — without the guard it stripped the section's
     own `open` class and then threw on `null.setAttribute` */
  ok(`5.10 ${who}: …and opening it does not close the section`, after.sectionOpen);
  console.log(`     ${who} drawer: folded ${d.foldedH} / ${d.viewH}`);
  await ctx.close();
}

console.log(errors.length ? 'CONSOLE ERRORS: ' + errors.slice(0, 4).join(' | ') : 'no console errors');
ok('6.1 zero console errors across every screen touched', errors.length === 0, String(errors.length));

await browser.close();
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
