/* V.02.4 — the scroll that would not come back, and the rows that scrolled
   sideways: pickers with a drop-down instead of chips running off the edge */
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';

/* V.02.7 removed the quick-chip row: «مفتوح الآن» and the specialities are
   reached through the ⚙ sheet now. These do through the sheet exactly what
   a tap on the old chip did, so the behaviour under test is unchanged and
   only the doorway moved. */
const viaSheet = async (page, fn) => {
  await page.click('#dirFilter'); await page.waitForTimeout(520);
  await fn();
  await page.click('#fApply'); await page.waitForTimeout(520);
};
const toggleOpenNow = (page) => viaSheet(page, () => page.click('#fOpenNow'));
/* V.04.0 reversed the sheet's SHAPE, not its contents: five headed groups
   of chips became two multi-select pickers, so an attribute is a row
   inside `#fDdTop` or `#fDdRest` rather than a chip in the sheet body. */
const attrHosts = [['#fCtlTop', '#fDdTop'], ['#fCtlRest', '#fDdRest']];
const toggleAttr = (page, id) => viaSheet(page, async () => {
  for (const [btn, host] of attrHosts) {
    if (!(await page.locator(btn).count())) continue;
    await page.evaluate(b => document.querySelector(b).click(), btn);
    await page.waitForTimeout(380);
    const hit = await page.evaluate(a => {
      const r = document.querySelector(a[0] + ' .dd-row[data-v="' + a[1] + '"]');
      if (r) { r.click(); return true; }
      return false;
    }, [host, id]);
    await page.waitForTimeout(300);
    if (hit) return;
    await page.evaluate(b => document.querySelector(b).click(), btn);
    await page.waitForTimeout(250);
  }
});
/** the ids the sheet offers for the current category */
const sheetAttrIds = async (page) => {
  await page.click('#dirFilter'); await page.waitForTimeout(520);
  const ids = [];
  for (const [btn, host] of attrHosts) {
    if (!(await page.locator(btn).count())) continue;
    await page.evaluate(b => document.querySelector(b).click(), btn);
    await page.waitForTimeout(380);
    ids.push(...await page.evaluate(h => [...document.querySelectorAll(h + ' .dd-row')].map(r => r.dataset.v), host));
    await page.evaluate(b => document.querySelector(b).click(), btn);
    await page.waitForTimeout(250);
  }
  await page.click('#fApply'); await page.waitForTimeout(520);
  return ids;
};
const activeAttrPills = (page) => page.evaluate(() =>
  [...document.querySelectorAll('#pills [data-off]')].map(b => b.dataset.off));


const BASE = process.env.BASE || 'http://localhost:8099/index.html';
let pass = 0, fail = 0;
const ok = (n, c, extra = '') => { if (c) { pass++; console.log('PASS ' + n + (extra ? ' -> ' + extra : '')); } else { fail++; console.log('FAIL ' + n + (extra ? ' -> ' + extra : '')); } };

const browser = await chromium.launch();
const ctx = await browser.newContext({ colorScheme: 'dark', viewport: { width: 390, height: 844 } });
const page = await ctx.newPage();
const errors = [];
page.on('console', m => { if (m.type() === 'error' && !/ERR_CONNECTION|ERR_CERT|ERR_TUNNEL|fonts\.googleapis/.test(m.text())) errors.push(m.text()); });
page.on('pageerror', e => errors.push('PAGEERROR ' + e.message + ' @ ' + (e.stack || '').split('\n')[1]));

const go = async (h) => { await page.evaluate(x => { location.hash = x; }, h); await page.waitForTimeout(520); };
const top = () => page.evaluate(() => document.getElementById('app').scrollTop);
const hash = () => page.evaluate(() => location.hash);
const panels = () => page.evaluate(() => document.querySelectorAll('.dd-panel').length);
/* a real wheel scroll, because that is what produced the bug: the browser
   zeroes the container on its own and the listener must not believe it */
const wheelTo = async (times) => {
  await page.mouse.move(195, 500);
  for (let i = 0; i < times; i++) { await page.mouse.wheel(0, 120); await page.waitForTimeout(20); }
  await page.waitForTimeout(350);
};
const midCard = () => page.evaluate(() => {
  const r = [...document.querySelectorAll('#dirList .list-row[data-route^="#/directory/"]')]
    .find(x => { const b = x.getBoundingClientRect(); return b.top > 150 && b.bottom < 700; });
  return r ? r.dataset.route : null;
});

await page.goto(BASE);
await page.waitForTimeout(700);

/* ============ 1 — back really does come back ============ */
console.log('--- the scroll ---');
await go('#/directory');
await wheelTo(20);
const y1 = await top();
const card = await midCard();
await page.click(`#dirList .list-row[data-route="${card}"]`);
await page.waitForTimeout(700);
ok('1.1 a real wheel scroll moved the list', y1 > 1200, String(y1));
ok('1.2 the listing opened', (await hash()) === card, await hash());
ok('1.3 the listing itself starts at the top', (await top()) < 60, String(await top()));
await page.goBack(); await page.waitForTimeout(800);
const y2 = await top();
ok('1.4 back lands on the same pixel', Math.abs(y2 - y1) < 80, y2 + ' vs ' + y1);
ok('1.5 …and on the same screen', (await hash()) === '#/directory');
ok('1.6 the card that was opened is flashed', await page.evaluate(
  (c) => !!document.querySelector(`#dirList .list-row[data-route="${c}"]`), card));

/* the search and the filters come back with it */
await go('#/directory?cat=restaurants&open=1');
await wheelTo(12);
const y3 = await top();
const card2 = await midCard();
await page.click(`#dirList .list-row[data-route="${card2}"]`); await page.waitForTimeout(650);
await page.goBack(); await page.waitForTimeout(800);
ok('1.7 a filtered list comes back to the same pixel', Math.abs((await top()) - y3) < 80,
   (await top()) + ' vs ' + y3);
ok('1.8 …with its filters still on', (await hash()).includes('cat=restaurants') && (await hash()).includes('open=1'),
   await hash());

/* a screen seen for the first time starts at the top, and so does a
   screen we deliberately forget */
await go('#/magazine');
ok('1.9 a screen opened for the first time starts at the top', (await top()) < 5, String(await top()));

/* ============ 2 — nothing a person chooses from scrolls sideways ============ */
console.log('--- no sideways choosing ---');
/* An element counts as "cut off" only when a real CHILD extends past it.
   An ad slide clips its own decorative sheen on purpose (`.slide::after`
   bleeds off the edge and `overflow: hidden` catches it) — that is design,
   not a row running off the screen, which is what this rule is about. */
const cutOff = () => page.evaluate(() => [...document.querySelectorAll('#app *')]
  .filter(e => e.scrollWidth > e.clientWidth + 2 && getComputedStyle(e).overflowX !== 'visible')
  .filter(e => {
    const box = e.getBoundingClientRect();
    return [...e.children].some(c => {
      const r = c.getBoundingClientRect();
      return r.right > box.right + 2 || r.left < box.left - 2;
    });
  })
  .map(e => (e.id || e.className || e.tagName).toString().slice(0, 30)));
for (const h of ['#/directory', '#/marketplace', '#/events', '#/magazine']) {
  await go(h);
  const cut = await cutOff();
  ok(`2.x ${h} has nothing cut off at the edge`, cut.length === 0, cut.join(' · '));
}
await go('#/directory');
ok('2.5 the old sideways category row is gone', await page.locator('#catChips').count() === 0);
ok('2.6 …and so is the grid button hidden at the end of it', await page.locator('#catGrid').count() === 0);
/* V.02.7: the quick chips are gone entirely — every filter is behind the
   ⚙ button and the two pickers, and what is on shows as ✕ pills. */
ok('2.7 the quick-chip row is gone too', await page.evaluate(() =>
  document.querySelector('#attrChips') === null));

/* ============ 3 — the picker row says what is filtered ============ */
console.log('--- the picker row ---');
const row = await page.evaluate(() => {
  const cat = document.querySelector('#ctlCat'), sort = document.querySelector('#ctlSort'),
        gear = document.querySelector('#dirFilter');
  const r = e => e.getBoundingClientRect();
  return {
    cat: cat.textContent.replace(/\s+/g, ' ').trim(),
    sort: sort.textContent.replace(/\s+/g, ' ').trim(),
    sameLine: Math.abs(r(cat).top - r(sort).top) < 2 && Math.abs(r(cat).top - r(gear).top) < 2,
    grows: r(cat).width > 80 && Math.abs(r(cat).width - r(sort).width) < 2,
    gearFixed: Math.round(r(gear).width) === 46,
    h: Math.round(r(cat).height),
  };
});
ok('3.1 both pickers and the filter button share one line', row.sameLine);
ok('3.2 the pickers share the space, the filter button keeps its own', row.grows && row.gearFixed);
ok('3.3 the category picker prints what is chosen', /الكل/.test(row.cat), row.cat);
ok('3.4 the sort picker prints what is chosen', /الأحدث/.test(row.sort), row.sort);

/* ============ 4 — the list itself ============ */
console.log('--- the drop-down ---');
await page.click('#ctlCat'); await page.waitForTimeout(400);
const dd = await page.evaluate(() => {
  const rows = [...document.querySelectorAll('.dd-row')];
  const panel = document.querySelector('.dd-panel');
  const list = document.querySelector('#dirList');
  const counts = rows.slice(1).map(r => +r.querySelector('.chip-n').textContent);
  return {
    n: rows.length,
    head: document.querySelector('.dd-head').textContent.replace(/\s+/g, ' ').trim(),
    first: rows[0].dataset.v,
    descending: counts.every((c, i) => i === 0 || counts[i - 1] >= c),
    pushes: list.getBoundingClientRect().top >= panel.getBoundingClientRect().bottom - 2,
    maxH: Math.round(document.querySelector('.dd-scroll').getBoundingClientRect().height),
    scrolls: getComputedStyle(document.querySelector('.dd-scroll')).overflowY,
    role: panel.getAttribute('role'),
    options: document.querySelectorAll('[role="option"]').length,
    selected: document.querySelectorAll('.dd-row[aria-selected="true"]').length,
    expanded: document.querySelector('#ctlCat').getAttribute('aria-expanded'),
    tick: !!document.querySelector('.dd-row.selected .dd-tick svg'),
    goldName: getComputedStyle(document.querySelector('.dd-row.selected .dd-name')).color,
  };
});
ok('4.1 every category is in the list at once', dd.n === 22, String(dd.n));
ok('4.2 the head names it and counts it', /اختر تصنيفاً/.test(dd.head) && /22 تصنيف/.test(dd.head), dd.head);
ok('4.3 "all" is always the first row', dd.first === 'all');
ok('4.4 the rest are ordered by how much is behind them', dd.descending);
ok('4.5 the panel pushes the results down rather than covering them', dd.pushes);
ok('4.6 it is capped at 45dvh and scrolls inside itself', dd.maxH <= Math.round(844 * 0.45) + 1 && dd.scrolls === 'auto',
   dd.maxH + 'px / ' + dd.scrolls);
ok('4.7 it is a listbox with options', dd.role === 'listbox' && dd.options === 22);
ok('4.8 the chosen row is marked for a screen reader and for the eye',
   dd.selected === 1 && dd.tick && dd.goldName === 'rgb(228, 199, 126)', dd.goldName);
ok('4.9 the button says it is expanded', dd.expanded === 'true');

/* one panel at a time */
await page.click('#ctlSort'); await page.waitForTimeout(350);
ok('4.10 opening one closes the other', await panels() === 1
   && await page.evaluate(() => document.querySelector('#ctlCat').getAttribute('aria-expanded')) === 'false');
await page.keyboard.press('Escape'); await page.waitForTimeout(300);
ok('4.11 Escape closes it', await panels() === 0);

/* keyboard */
await page.click('#ctlCat'); await page.waitForTimeout(320);
await page.keyboard.press('ArrowDown'); await page.keyboard.press('ArrowDown');
const focus = await page.evaluate(() => document.activeElement.dataset.v);
await page.keyboard.press('Enter'); await page.waitForTimeout(600);
ok('4.12 the arrows move down the list', focus === 'restaurants', String(focus));
ok('4.13 Enter picks what is focused', (await hash()).includes('cat=restaurants'), await hash());

/* picking */
const picked = await page.evaluate(() => ({
  closed: document.querySelectorAll('.dd-panel').length === 0,
  label: document.querySelector('#ctlCat .ctl-v').textContent.trim(),
  rows: document.querySelectorAll('#dirList .list-row[data-route^="#/directory/"]').length,
  chips: document.querySelectorAll('#attrChips .chip').length,   // 0 since V.02.7
}));
ok('4.14 choosing closes the panel at once', picked.closed);
ok('4.15 …writes the choice on the button', picked.label === 'مطاعم', picked.label);
/* 138 since b321 (Cafe Mawal) closed and its record was deleted */
ok('4.16 …filters the list', picked.rows === 138, String(picked.rows));
/* V.02.7: there are no quick chips to bring — the row is gone and every
   filter is behind the ⚙ button. */
ok('4.17 …and brings no chip row with it', picked.chips === 0, String(picked.chips));

/* outside tap and the device back button */
await page.click('#ctlCat'); await page.waitForTimeout(320);
const before = await hash();
await page.mouse.click(195, 800);
await page.waitForTimeout(500);
ok('4.18 a tap outside closes it', await panels() === 0);
ok('4.19 …and does not press whatever was under the finger', (await hash()) === before, await hash());

await page.click('#ctlCat'); await page.waitForTimeout(350);
await page.goBack(); await page.waitForTimeout(600);
ok('4.20 the device back button closes the panel', await panels() === 0);
ok('4.21 …and stays on the directory', (await hash()).startsWith('#/directory'), await hash());
await page.click('#ctlCat'); await page.waitForTimeout(300);
await page.click('#ctlSort'); await page.waitForTimeout(300);
await page.goBack(); await page.waitForTimeout(600);
ok('4.22 one back closes it even after switching pickers', await panels() === 0 && (await hash()).startsWith('#/directory'),
   await hash());

/* the sort picker really sorts */
await go('#/directory');
await page.click('#ctlSort'); await page.waitForTimeout(320);
const sorts = await page.evaluate(() => [...document.querySelectorAll('.dd-row')].map(r => r.dataset.v));
await page.evaluate(() => document.querySelector('.dd-row[data-v="rated"]').click());
await page.waitForTimeout(600);
ok('4.23 the sort list holds every order', sorts.join(',') === 'newest,nearest,rated,open', sorts.join(','));
ok('4.24 picking one sorts and shows on the button',
   (await hash()).includes('sort=rated')
   && await page.evaluate(() => document.querySelector('#ctlSort .ctl-v').textContent.trim()) === 'الأعلى تقييماً');

/* ============ 5 — the other screens ============ */
console.log('--- the other screens ---');
await go('#/events');
await page.click('#ctlType'); await page.waitForTimeout(350);
const ev = await page.evaluate(() => ({
  rows: [...document.querySelectorAll('.dd-row')].map(r => r.dataset.v),
  head: document.querySelector('.dd-head').textContent.replace(/\s+/g, ' ').trim(),
}));
ok('5.1 the event types come down in a list', ev.rows.length >= 4 && ev.rows[0] === 'all', ev.rows.join(' '));
ok('5.2 …named and counted', /اختر نوع الفعالية/.test(ev.head) && /\d/.test(ev.head), ev.head);
await page.evaluate(() => document.querySelector('.dd-row[data-v="festival"]').click());
await page.waitForTimeout(550);
ok('5.3 picking a type filters the events', (await hash()).includes('type=festival'), await hash());
ok('5.4 …and the button says which', await page.evaluate(() =>
  document.querySelector('#ctlType .ctl-v').textContent.trim()) === 'مهرجانات');

await go('#/marketplace');
await page.click('#ctlSec'); await page.waitForTimeout(350);
ok('5.5 the marketplace sections come down in a list', await page.locator('.dd-row').count() >= 8,
   String(await page.locator('.dd-row').count()));
await page.evaluate(() => document.querySelector('.dd-row[data-v="cars"]').click());
await page.waitForTimeout(550);
ok('5.6 picking one filters the marketplace', (await hash()).includes('cat=cars'), await hash());
ok('5.7 …and the button says which', await page.evaluate(() =>
  document.querySelector('#ctlSec .ctl-v').textContent.trim()) === 'سيارات');

await go('#/magazine');
/* V.04.0 went one better than wrapping: six sections is over the line the
   rule draws at five, so the magazine took the same picker as everything
   else. Nothing to wrap and nothing to scroll. */
ok('5.8 the magazine is a picker, and nothing scrolls sideways', await page.evaluate(() => {
  const b = document.querySelector('#ctlMag');
  return !!b && !document.querySelector('#magChips .chip')
    && document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1;
}));

await go('#/home');
ok('5.9 home keeps its circle row — it shows, it does not filter',
   await page.locator('#cats .cat-item').count() === 5);
ok('5.10 …with one tap to every category', await page.locator('[data-route="#/categories"]').count() >= 1);

/* ============ 6 — it costs less height than the rows it replaced ============ */
await go('#/directory');
const yAll = await page.evaluate(() => Math.round(document.querySelector('#dirList').getBoundingClientRect().top));
/* V.02.8 reverses the V.02.4 number deliberately: every section now
   carries a slider and two sponsored rows above its content. The promise
   that survives is that the paid block is bounded and the results are the
   next thing after it — not that they start at 272px. */
ok('6.1 the paid block is bounded, and the results follow it', await page.evaluate(() =>
  document.querySelectorAll('#catSlider .slider').length === 1
  && document.querySelectorAll('#sponRows .list-row.spon').length <= 2
  && !!document.querySelector('#dirList .list-row')), yAll + 'px');

/* ============ 7 — English ============ */
await page.evaluate(() => { const s = JSON.parse(localStorage.getItem('arabna.v1')); s.lang = 'en'; localStorage.setItem('arabna.v1', JSON.stringify(s)); });
await page.goto(BASE); await page.waitForTimeout(600);
await go('#/directory');
const enCtl = await page.evaluate(() =>
  document.querySelector('#ctlCat').textContent.replace(/\s+/g, '').trim());
ok('7.1 the pickers are translated', enCtl === 'CategoryAll', enCtl);
await page.click('#ctlCat'); await page.waitForTimeout(350);
ok('7.2 the head counts in English', /22 categories/.test(await page.textContent('.dd-head')),
   (await page.textContent('.dd-head')).trim());
await page.keyboard.press('Escape'); await page.waitForTimeout(250);
const cutEn = await cutOff();
ok('7.3 nothing is cut off in English either', cutEn.length === 0, cutEn.join(' · '));

ok('99 no console errors anywhere', errors.length === 0, errors.slice(0, 3).join(' | '));
console.log(`\n${pass} passed, ${fail} failed`);
await browser.close();
process.exit(fail ? 1 : 0);
