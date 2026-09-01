/* V.01.6 — commercial prices hidden from visitors; ad packages explained in place */
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import { withDemoData } from './_demo.mjs';

const BASE = process.env.BASE || 'http://localhost:8123/index.html';
let pass = 0, fail = 0;
const ok = (n, c, extra = '') => { if (c) { pass++; console.log('PASS ' + n + (extra ? ' -> ' + extra : '')); } else { fail++; console.log('FAIL ' + n + (extra ? ' -> ' + extra : '')); } };

const browser = await chromium.launch();
/* ⚠️ THIS SUITE USES THE INVENTED RECORDS AS ITS FIXTURE, and `510`
   turned them off by default. It turns them on for itself — the
   default is not reverted and no assertion is softened. */
await withDemoData(browser);
const page = await (await browser.newContext({ colorScheme: 'dark', viewport: { width: 390, height: 844 } })).newPage();
const errors = [];
page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
page.on('pageerror', e => errors.push('PAGEERROR ' + e.message));

const go = async (h) => { await page.evaluate(x => { location.hash = x; }, h); await page.waitForTimeout(340); };
const hash = () => page.evaluate(() => location.hash);
const txt = () => page.textContent('#app');
/** every dollar figure rendered on the current screen */
const dollars = async () => ((await txt()) || '').match(/\$[\d,]+/g) || [];
const dismissSheet = async () => {
  await page.evaluate(() => { const s = document.querySelector('.sheet-scrim'); if (s) s.click(); });
  await page.waitForTimeout(420);
};

await page.goto(BASE);
await page.waitForTimeout(800);

/* ======================================================================
   PART 1 — the visitor sees no commercial price anywhere
   ====================================================================== */
console.log('--- visitor: advertise ---');
await go('#/advertise');

let money = await dollars();
ok('advertise: not one dollar figure on screen', money.length === 0, money.join(' '));
// five after V.01.8; eight after V.02.8 added a slider to each section
ok('advertise: every package still listed',
   await page.evaluate(() => document.querySelectorAll('#prods .ad-card').length) === 8);
ok('advertise: no price-amt element rendered',
   await page.evaluate(() => document.querySelectorAll('.price-amt').length) === 0);
let body = await txt();
ok('advertise: the gate note sits under the button', body.includes('السعر يظهر بعد إنشاء حساب مجاني'));
// V.02.7: «شوف» became «اعرض» — plain MSA, not a dialect
ok('advertise: the gold unlock button is shown', body.includes('اعرض الأسعار'));
ok('advertise: no screen-wide next button', await page.locator('#next1').count() === 0);
ok('advertise: the step dots are hidden for a visitor', await page.locator('.step-dot').count() === 0);

/* cheapest first, cheapest preselected */
const order = await page.evaluate(() => Array.from(document.querySelectorAll('#prods .ad-card')).map(c => c.dataset.group));
ok('packages ordered cheapest first',
   JSON.stringify(order) === JSON.stringify(
     ['mini', 'magazine', 'events', 'catSlider', 'market', 'event', 'slider', 'story']),
   order.join(' → '));
ok('the cheapest package is preselected',
   await page.evaluate(() => document.querySelector('#prods .ad-card').classList.contains('selected')));
ok('the preselected package is "mini"',
   await page.evaluate(() => document.querySelector('#prods .ad-card.selected').dataset.group) === 'mini');

/* the expansion: one open at a time, in place, no navigation */
console.log('--- expansion in place ---');
const openHeight = (id) => page.evaluate((g) => {
  const el = document.querySelector(`.ad-card[data-group="${g}"] .ad-more-inner`);
  return Math.round(el.getBoundingClientRect().height);
}, id);

ok('the selected package is expanded', (await openHeight('mini')) > 100, (await openHeight('mini')) + 'px');
ok('the others are collapsed to zero',
   (await openHeight('slider')) === 0 && (await openHeight('story')) === 0 && (await openHeight('event')) === 0);

const beforeTap = await hash();
await page.click('#prods .ad-card[data-group="story"] .price-card');
await page.waitForTimeout(400);
ok('tapping a package does not navigate away', (await hash()) === beforeTap, await hash());
ok('the tapped package expanded', (await openHeight('story')) > 100, (await openHeight('story')) + 'px');
ok('the previous one folded', (await openHeight('mini')) === 0);
ok('only one is open at a time',
   await page.evaluate(() => document.querySelectorAll('#prods .ad-card.selected').length) === 1);
ok('aria-expanded tracks the open card',
   await page.getAttribute('.ad-card[data-group="story"] .price-card', 'aria-expanded') === 'true'
   && await page.getAttribute('.ad-card[data-group="mini"] .price-card', 'aria-expanded') === 'false');
ok('the gate remembers the chosen package',
   await page.getAttribute('.ad-card.selected [data-pricegate]', 'data-pricegate') === '#/advertise/story',
   await page.getAttribute('.ad-card.selected [data-pricegate]', 'data-pricegate'));
ok('expanding still shows no price', (await dollars()).length === 0);

/* the placement diagram */
console.log('--- placement preview ---');
for (const [id, where] of [['mini', 'تحت التصنيفات'], ['event', 'أعلى قسم الفعاليات'],
                           ['slider', 'أعلى الصفحة الرئيسية'], ['story', 'داخل قائمة المجلة']]) {
  await page.click(`#prods .ad-card[data-group="${id}"] .price-card`);
  await page.waitForTimeout(330);
  const pv = await page.evaluate((g) => {
    const card = document.querySelector(`.ad-card[data-group="${g}"]`);
    const ph = card.querySelector('.ph');
    const ad = card.querySelector('.ph-ad');
    const rows = Array.from(ph.querySelectorAll('.ph-row'));
    return {
      phone: !!ph,
      height: Math.round(ph.getBoundingClientRect().height),
      litIndex: rows.indexOf(ad),
      rowCount: rows.length,
      label: (card.querySelector('.ad-here') || {}).textContent,
      where: (card.querySelector('.ad-where') || {}).textContent,
      points: card.querySelectorAll('.ad-points li').length,
      // the lit slot must actually be gold, not just a class name
      gold: /198|228|226/.test(getComputedStyle(ad).backgroundImage + getComputedStyle(ad).backgroundColor),
    };
  }, id);
  ok(id + ': phone wireframe drawn', pv.phone);
  ok(id + ': wireframe is ~140px tall', pv.height >= 130 && pv.height <= 150, pv.height + 'px');
  ok(id + ': one slot lit in gold', pv.litIndex >= 0 && pv.gold, 'row ' + pv.litIndex + '/' + pv.rowCount);
  ok(id + ': labelled "إعلانك هنا"', (pv.label || '').includes('إعلانك هنا'));
  ok(id + ': names the surface', (pv.where || '').includes(where), pv.where);
  ok(id + ': carries four benefit points', pv.points === 4, pv.points + ' points');
}
/* each package lights a different row — otherwise the diagram says nothing */
const litRows = await page.evaluate(() => {
  const out = {};
  document.querySelectorAll('#prods .ad-card').forEach(c => {
    const rows = Array.from(c.querySelectorAll('.ph-row'));
    out[c.dataset.group] = rows.indexOf(c.querySelector('.ph-ad'));
  });
  return out;
});
ok('each package lights its own position',
   new Set(Object.values(litRows)).size >= 3, JSON.stringify(litRows));

/* the guide sheet */
console.log('--- "which one suits me?" ---');
await page.click('#guideBtn'); await page.waitForTimeout(450);
const sheet = await page.textContent('#sheet');
ok('guide sheet opens', (await page.locator('.sheet-panel').count()) === 1);
ok('the guide has one line per package',
   await page.locator('.guide-row').count() === 5,
   String(await page.locator('.guide-row').count()));
ok('guide shows no price', !/\$[\d,]+/.test(sheet), (sheet.match(/\$[\d,]+/g) || []).join(' '));
for (const line of ['أكبر ظهور', 'ميزانيتي محدودة', 'قصة أو افتتاح', 'فعالية بتاريخ']) {
  ok('guide line: ' + line, sheet.includes(line));
}
await page.click('.guide-row[data-g="event"]'); await page.waitForTimeout(650);
ok('a guide line selects that package',
   await page.evaluate(() => document.querySelector('#prods .ad-card.selected').dataset.group) === 'event');
ok('…and expands it', (await openHeight('event')) > 100);
ok('…and closes the sheet', await page.locator('.sheet-panel').count() === 0);
ok('guide selection updates the gate too',
   await page.getAttribute('.ad-card.selected [data-pricegate]', 'data-pricegate') === '#/advertise/event');

/* ======================================================================
   PART 2 — every other commercial price
   ====================================================================== */
console.log('--- visitor: the rest of the app ---');
await go('#/directory');
money = await dollars();
ok('directory: no subscription price in the upsell row', money.length === 0, money.join(' '));
// V.03.4: «بزنسك» → «نشاطك», the glossary word
ok('directory: the upsell still offers the upgrade', (await txt()).includes('رقّي صفحة نشاطك'));
ok('directory: the row says prices come after signup', (await txt()).includes('الأسعار تظهر بعد'));

await go('#/subscribe');
money = await dollars();
ok('subscribe: no price shown', money.length === 0, money.join(' '));
body = await txt();
// V.01.9 re-cut the plan: reviews left it, "your page only yours" joined it
ok('subscribe: every benefit still listed',
   body.includes('صور غير محدودة') && body.includes('صفحتك لك وحدك') && body.includes('موثّق'),
   body.includes('صور غير محدودة') + '/' + body.includes('صفحتك لك وحدك') + '/' + body.includes('موثّق'));
ok('subscribe: the unlock button is shown (singular)', body.includes('سجّل مجاناً واعرض السعر'));
ok('subscribe: no "subscribe now" button for a visitor', await page.locator('#subBtn').count() === 0);

await go('#/marketplace?cat=handyman');
money = await dollars();
ok('handyman upsell: no $29', !money.includes('$29'), money.join(' '));

await go('#/boost/c1');
ok('boost screen refuses a visitor', (await hash()).startsWith('#/auth/'), await hash());

await go('#/profile/edit');
ok('profile edit refuses a visitor', (await hash()).startsWith('#/auth/'), await hash());

/* the exception: marketplace item prices are content, not our prices */
console.log('--- the exception: item prices stay ---');
await go('#/marketplace');
money = await dollars();
ok('marketplace: item prices ARE visible to a visitor', money.length >= 3, money.join(' '));
ok('marketplace: the "free" label is visible', (await txt()).includes('مجاني'));
await go('#/marketplace/c1');
ok('listing detail: its price is visible', (await dollars()).length >= 1, (await dollars()).join(' '));

/* nothing anywhere else leaks a commercial figure */
for (const r of ['#/home', '#/events', '#/magazine', '#/categories', '#/profile']) {
  await go(r);
  const m = await dollars();
  const bad = m.filter(x => ['$149', '$49', '$199', '$99', '$29', '$269', '$449'].includes(x));
  ok('visitor sees no commercial price on ' + r, bad.length === 0, bad.join(' ') || 'clean');
}

/* ======================================================================
   PART 3 — sign up from the gate and land back on the same package
   ====================================================================== */
console.log('--- gate → signup → back with prices ---');
await go('#/advertise');
await page.click('#prods .ad-card[data-group="story"] .price-card'); await page.waitForTimeout(350);
await page.evaluate(() => document.querySelector('.ad-card.selected [data-pricegate]').click());
await page.waitForTimeout(600);
ok('the gate starts the signup flow', (await hash()).startsWith('#/auth/signup'), await hash());

// V.02.7: one name field became two, and the password is confirmed


await page.fill('#sFirst', 'رامي');


await page.fill('#sLast', 'البي');
await page.fill('#sEmail', 'rami@arabna.app');
await page.fill('#sPass', 'Rami2026$');

await page.fill('#sPass2', 'Rami2026$');
await page.check('#agree1'); await page.check('#agree2');
await page.click('#suBtn'); await page.waitForTimeout(900);
await page.click('[data-fill="e"]'); await page.click('#vBtn'); await page.waitForTimeout(1000);

ok('after verifying, the user is returned to advertise',
   (await hash()).startsWith('#/advertise'), await hash());
ok('…on the very package they had chosen', (await hash()) === '#/advertise/story', await hash());
ok('…with the prices now visible', (await dollars()).length >= 4, (await dollars()).join(' '));
ok('…and that package still selected and open',
   await page.evaluate(() => document.querySelector('#prods .ad-card.selected').dataset.group) === 'story');

/* ======================================================================
   PART 4 — the member sees everything, cheapest first
   ====================================================================== */
console.log('--- member ---');
await go('#/advertise');
body = await txt();
ok('member: prices are back on every card',
   await page.evaluate(() => document.querySelectorAll('.price-amt').length) === 8);
ok('member: the step dots are back', await page.locator('.step-dot').count() === 4);
ok('member: the gate is gone', await page.locator('[data-pricegate]').count() === 0);
// V.01.7: the screen-wide next button was replaced by a button inside each package
ok('member: the package carries the action button',
   await page.locator('.ad-card.selected [data-start]').count() === 1);
ok('member: the guide link is still there', await page.locator('#guideBtn').count() === 1);
ok('member: expansion still works',
   (await openHeight('mini')) > 100 && (await openHeight('story')) === 0);

const amts = await page.evaluate(() => Array.from(document.querySelectorAll('.price-amt'))
  .map(e => Number(e.textContent.replace(/[^0-9]/g, ''))));
ok('member: the first price shown is the cheapest', amts[0] === Math.min(...amts), amts.join(' → '));
ok('member: prices ascend down the list',
   amts.every((v, i) => i === 0 || v >= amts[i - 1]), amts.join(' → '));

/* the flow still completes */
await page.evaluate(() => document.querySelector('.ad-card.selected [data-start]').click());
await page.waitForTimeout(400);
ok('step 2 reachable for a member', (await page.locator('#durs').count()) === 1);
ok('step 2 quotes durations with prices', (await dollars()).length >= 3, (await dollars()).join(' '));

await go('#/directory');
ok('member: the $29 upsell price is back', (await dollars()).includes('$29'), (await dollars()).join(' '));
await go('#/subscribe');
ok('member: subscribe shows the price', (await dollars()).includes('$29'));
ok('member: subscribe shows its CTA', await page.locator('#subBtn').count() === 1);
await go('#/marketplace?cat=handyman');
ok('member: handyman upsell shows $29', (await dollars()).includes('$29'));
/* V.03.7: `myListings` no longer ships with `['c1']` in it — a visitor who
   had never signed up owned a seed listing — so a member who is to boost
   one has to own one. That is the fixture doing what publishing does. */
await page.evaluate(async () => {
  const S = (window.__m && window.__m.S)
    || await import('arabna/js/store.js').catch(() => import('./js/store.js'));
  if (!S.state.myListings.includes('c1')) { S.state.myListings.push('c1'); S.save(); }
});
await go('#/boost/c1');
ok('member: boost screen opens', (await hash()) === '#/boost/c1', await hash());
ok('member: boost prices shown', (await dollars()).length >= 3, (await dollars()).join(' '));

/* ======================================================================
   PART 5 — English
   ====================================================================== */
console.log('--- English ---');
await go('#/home');
await page.evaluate(() => document.querySelector('#hMenu').click()); await page.waitForTimeout(420);
await page.click('#drLang'); await page.waitForTimeout(650);
ok('switched to English', await page.evaluate(() => document.documentElement.lang === 'en'));

await go('#/advertise');
body = await txt();
ok('EN member: prices shown', (await dollars()).length >= 4);
ok('EN: package points are in English', body.includes('Top of Home') || body.includes('the budget option')
   || body.includes('The budget option'));
ok('EN: placement label translated', body.includes('Your ad here'));
ok('EN: guide link translated', body.includes('Which package fits you?'));
await page.click('#guideBtn'); await page.waitForTimeout(430);
ok('EN guide sheet translated', (await page.textContent('#sheet')).includes('Which one suits me'));
await dismissSheet();

/* sign out → English visitor. #/advertise uses the simple header, so the
   drawer has to be opened from a screen that has the menu button. */
await go('#/home');
await page.evaluate(() => document.querySelector('#hMenu').click()); await page.waitForTimeout(430);
await page.click('#drOut'); await page.waitForTimeout(430);
await page.evaluate(() => document.querySelector('#cfmYes').click());
await page.waitForTimeout(700);

await go('#/advertise');
ok('EN visitor: no dollar figure', (await dollars()).length === 0, (await dollars()).join(' '));
body = await txt();
ok('EN visitor: gate note translated', body.includes('The price shows after a free account'));
ok('EN visitor: gate button translated', body.includes('See the prices'));
ok('EN visitor: packages and points still complete',
   await page.evaluate(() => document.querySelectorAll('#prods .ad-card').length) === 8
   && await page.evaluate(() => document.querySelectorAll('.ad-points li').length) === 32);

await go('#/marketplace');
ok('EN visitor: item prices still visible (the exception)', (await dollars()).length >= 3);
await go('#/subscribe');
ok('EN visitor: subscribe gated', (await dollars()).length === 0
   && (await txt()).includes('Sign up free to see the price'));

/* back to Arabic for a clean end state */
await go('#/home');
await page.evaluate(() => document.querySelector('#hMenu').click()); await page.waitForTimeout(430);
await page.click('#drLang'); await page.waitForTimeout(600);
ok('language toggles back to Arabic', await page.evaluate(() => document.documentElement.dir === 'rtl'));

const real = errors.filter(e => !/favicon|ERR_CONNECTION_RESET|Failed to load resource/i.test(e));
ok('no console errors', real.length === 0, real.slice(0, 4).join(' | '));

console.log(`\n${pass} passed, ${fail} failed`);
await browser.close();
process.exit(fail ? 1 : 0);
