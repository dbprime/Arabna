/* V.02.1 — the outings category, the entry price, the halal strip
   and the non-commercial flag */
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import { readFileSync, existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';

/* V.02.7: one speciality from every group is required before a save. The
   chips live inside collapsed boxes; a programmatic click reaches them. */
const fillAllGroups = () => page.evaluate(() => {
  document.querySelectorAll('.attr-box').forEach(box => {
    if (box.querySelector('.chip.active')) return;
    const c = box.querySelector('.chip');
    if (c) c.click();
  });
});


const BASE = process.env.BASE || 'http://localhost:8099/index.html';
const DL = '/tmp/claude-0/-home-user-Arabna/251db543-2065-5c48-ad10-c7376686ff5c/scratchpad/dl11';
if (existsSync(DL)) rmSync(DL, { recursive: true });
mkdirSync(DL, { recursive: true });

let pass = 0, fail = 0;
const ok = (n, c, extra = '') => { if (c) { pass++; console.log('PASS ' + n + (extra ? ' -> ' + extra : '')); } else { fail++; console.log('FAIL ' + n + (extra ? ' -> ' + extra : '')); } };

const browser = await chromium.launch();
const ctx = await browser.newContext({ colorScheme: 'dark', viewport: { width: 390, height: 844 }, acceptDownloads: true });
const page = await ctx.newPage();
const errors = [];
page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
page.on('pageerror', e => errors.push('PAGEERROR ' + e.message));

/* assigning the same hash does not re-render, so every hop passes through
   home — the harness bug that once made accumulated filters look like an
   app fault */
const go = async (h) => {
  await page.evaluate(() => { location.hash = '#/home'; });
  await page.waitForTimeout(120);
  await page.evaluate(x => { location.hash = x; }, h);
  await page.waitForTimeout(380);
};
/* V.04.0 reversed the SHEET'S SHAPE, not its contents. Five headed groups
   and sixteen options were two screens of scrolling; they collapsed into
   two multi-select pickers — «الأكثر استخداماً» and «خيارات إضافية» — so
   the named group headings are gone and every option is a row inside one
   of the two panels. What this suite guards is unchanged: which
   specialities the sheet offers for `outings`, and that one of them
   actually bites. So the options are read from the panels now. */
const sheetAttrs = async () => {
  const out = [];
  for (const [btn, host] of [['#fCtlTop', '#fDdTop'], ['#fCtlRest', '#fDdRest']]) {
    const has = await page.evaluate(b => !!document.querySelector(b), btn);
    if (!has) continue;
    await page.evaluate(b => document.querySelector(b).click(), btn);
    await page.waitForTimeout(380);
    out.push(...await page.evaluate(h => [...document.querySelectorAll(h + ' .dd-row')]
      .map(r => ({ id: r.dataset.v, label: r.querySelector('.dd-name').textContent.trim() })), host));
    await page.evaluate(b => document.querySelector(b).click(), btn);
    await page.waitForTimeout(280);
  }
  return out;
};
const pickAttr = async (id) => {
  for (const [btn, host] of [['#fCtlTop', '#fDdTop'], ['#fCtlRest', '#fDdRest']]) {
    const has = await page.evaluate(b => !!document.querySelector(b), btn);
    if (!has) continue;
    await page.evaluate(b => document.querySelector(b).click(), btn);
    await page.waitForTimeout(380);
    const hit = await page.evaluate(a => {
      const r = document.querySelector(a[0] + ' .dd-row[data-v="' + a[1] + '"]');
      if (r) { r.click(); return true; }
      return false;
    }, [host, id]);
    await page.waitForTimeout(300);
    /* the multi-select stays open by design, so shut it before the sheet's
       footer is pressed — an open panel covers #fApply */
    await page.evaluate(b => document.querySelector(b).click(), btn);
    await page.waitForTimeout(250);
    if (hit) return true;
  }
  return false;
};
const txt = () => page.textContent('#app');
const has = async (s) => (await txt()).includes(s);
const adminLogin = async () => {
  await go('#/admin');
  /* V.03.6 — nothing ships a staff password any more, so a device is
     CLAIMED before it can be logged into. This is the fixture doing what
     the owner does once on the first run; the route is re-entered because
     the setup screen is already on screen by the time we get here. */
  await page.evaluate(async () => {
    const S = (window.__m && window.__m.S)
      || await import('arabna/js/store.js').catch(() => import('./js/store.js'));
    if (!S.adminIsSet()) { await S.setAdminPass('Arabna@2026!', 'arabna.admin'); location.hash = '#/home'; }
  });
  await page.waitForTimeout(200);
  await page.evaluate(() => { location.hash = '#/admin'; });
  await page.waitForTimeout(600);
  if (await page.locator('#aUser').count()) {
    await page.fill('#aUser', 'arabna.admin');
    await page.fill('#aPass', 'Arabna@2026!');
    await page.click('#aGo'); await page.waitForTimeout(600);
  }
};
const grab = async (fn) => {
  const [dl] = await Promise.all([page.waitForEvent('download'), fn()]);
  const path = DL + '/' + dl.suggestedFilename();
  await dl.saveAs(path);
  return { name: dl.suggestedFilename(), text: readFileSync(path, 'utf8') };
};

await page.goto(BASE);
await page.waitForTimeout(800);
await page.evaluate(() => {
  const s = JSON.parse(localStorage.getItem('arabna.v1') || '{}');
  s.radius = 100;                       // the seeds spread past five miles
  localStorage.setItem('arabna.v1', JSON.stringify(s));
});
await page.reload(); await page.waitForTimeout(800);

/* ======================================================================
   PART 1 — the twenty-first category
   ====================================================================== */
console.log('--- the outings category ---');
await go('#/directory');
/* V.02.4: the categories come down in a list instead of running off the
   side of the screen. */
const chips = await (async () => {
  await page.click('#ctlCat'); await page.waitForTimeout(320);
  const v = await page.evaluate(() => Array.from(document.querySelectorAll('.dd-row')).map(r => r.dataset.v));
  await page.keyboard.press('Escape'); await page.waitForTimeout(220);
  return v.filter(x => x && x !== 'all');
})();
ok('the directory now offers twenty-one categories', chips.length === 21, chips.length + '');
ok('"outings" is one of them', chips.includes('outings'));
ok('"events" is still not a category', !chips.includes('events'));

await go('#/categories');
const cells = await page.evaluate(() => Array.from(document.querySelectorAll('.cat-grid')).pop()
  .querySelectorAll('.cat-cell').length);
ok('"all categories" shows twenty-one plus the events shortcut', cells === 22, cells + ' cells');
ok('the outings cell is named in Arabic', await has('ترفيه ونزهات'));
const outCell = await page.evaluate(() => {
  const c = Array.from(document.querySelectorAll('.cat-cell'))
    .find(x => x.dataset.route === '#/directory?cat=outings');
  return c ? { svg: !!c.querySelector('svg'), count: c.querySelector('.cc-count').textContent.trim() } : null;
});
ok('the outings cell carries an icon', !!(outCell && outCell.svg));
// 74 real Houston outings landed in V.02.1 on top of the four seeds
ok('the outings cell counts its places', outCell && +outCell.count >= 70, outCell && outCell.count);

await go('#/directory?cat=outings');
const outRows = await page.evaluate(() => Array.from(
  document.querySelectorAll('#dirList .list-row[data-route^="#/directory/"]'))
  .map(r => r.querySelector('.row-title').textContent.trim()));
ok('the category lands pre-filtered on its own places',
   outRows.length >= 70 && outRows.some(x => /Hermann Park/.test(x)),
   outRows.length + ' places');
ok('the arriving line names the section', await has('ترفيه ونزهات'));
ok('the category picker says "outings"', await page.evaluate(() =>
  document.querySelector('#ctlCat .ctl-v').textContent.trim()) === 'ترفيه ونزهات');

/* ======================================================================
   PART 2 — the speciality tree for outings
   ====================================================================== */
console.log('--- specialities ---');
await page.click('#dirFilter'); await page.waitForTimeout(520);
let attrs = await sheetAttrs();
let labels = attrs.map(a => a.label);
ok('the filter sheet still holds the outings specialities', attrs.length >= 10, attrs.length + ' options');
for (const label of ['حديقة عامة', 'محمية طبيعية', 'ترامبولين', 'متحف'])
  ok('filter offers the kind: ' + label, labels.includes(label));
for (const label of ['مسموح إحضار الطعام', 'يوجد مكان للشواء', 'دخول مجاني', 'بتذاكر'])
  ok('filter offers the feature: ' + label, labels.includes(label));
// defined for the category, but no Houston listing carries either one yet
const ids = attrs.map(a => a.id);
ok('the sheet never offers a speciality with nothing behind it',
   !ids.includes('outWaterPark') && !ids.includes('prByAppt'));
// apply one and see it bite
ok('«يوجد مكان للشواء» is pickable', await pickAttr('outBbq'));
await page.click('#fApply'); await page.waitForTimeout(500);
const bbqRows = await page.evaluate(() => Array.from(
  document.querySelectorAll('#dirList .list-row[data-route^="#/directory/"]'))
  .map(r => r.querySelector('.row-title').textContent.trim()));
ok('"there is a BBQ pit" narrows the list to the park that has one',
   bbqRows.length === 1 && bbqRows[0].includes('الواحة'), bbqRows.join(' · '));

/* ======================================================================
   PART 3 — a public place is never sold to
   ====================================================================== */
console.log('--- non-commercial ---');
await go('#/directory/b26');
let body = await txt();
ok('the park page opens', body.includes('حديقة الواحة'));
ok('no claim button on a public place', await page.locator('#claimBtn').count() === 0);
ok('no claim invitation text', !body.includes('هذا نشاطك؟'));
ok('no subscription or upgrade card', await page.evaluate(() =>
  !document.querySelector('[data-route^="#/subscribe"]')));
ok('it says plainly why', body.includes('مكان عام'));
ok('free entry is stated once, in the chip row, and never priced',
   body.includes('دخول مجاني') && !body.includes('سعر الدخول'));
ok('the standing warning is there', body.includes('الأسعار والأوقات تتغيّر'));
ok('halal restaurants nearby are offered', body.includes('مطاعم حلال قريبة'));
const halalRows = await page.evaluate(() => {
  const heads = Array.from(document.querySelectorAll('.similar'));
  const h = heads.find(x => x.textContent.includes('مطاعم حلال'));
  return h ? Array.from(h.querySelectorAll('.list-row')).map(r => r.querySelector('.row-title').textContent.trim()) : [];
});
ok('exactly three of them', halalRows.length === 3, halalRows.join(' · '));
ok('all three are restaurants', await page.evaluate((names) => {
  const routes = Array.from(document.querySelectorAll('.similar')).find(x => x.textContent.includes('مطاعم حلال'));
  return Array.from(routes.querySelectorAll('.list-row')).every(r => /#\/directory\/b/.test(r.dataset.route));
}, halalRows));

/* the ticketed half of the same category is an ordinary business */
await go('#/directory/b28');
body = await txt();
ok('a ticketed place keeps its claim button', await page.locator('#claimBtn').count() === 1);
ok('a ticketed place shows its entry price', body.includes('$18 / hour'));
ok('…and does not say "free entry"', !body.includes('دخول مجاني'));
ok('…and carries the same standing warning', body.includes('الأسعار والأوقات تتغيّر'));
ok('a ticketed place is also offered halal food nearby', body.includes('مطاعم حلال قريبة'));

/* nothing of this leaks onto other categories */
await go('#/directory/b1');
body = await txt();
ok('a restaurant page has no entry price', !body.includes('سعر الدخول'));
ok('a restaurant page has no outings warning', !body.includes('الأسعار والأوقات تتغيّر'));
ok('a restaurant page has no halal strip on itself', !body.includes('مطاعم حلال قريبة'));

/* ======================================================================
   PART 4 — the admin flag
   ====================================================================== */
console.log('--- admin: mark a place non-commercial ---');
await adminLogin();
await page.click('[data-t="dir"]'); await page.waitForTimeout(450);
ok('the admin panel offers the non-commercial control', await page.locator('#ncPick').count() === 1);
ok('…with both directions', await page.locator('#ncOn').count() === 1 && await page.locator('#ncOff').count() === 1);
const markedBefore = await page.locator('#aBody [data-ncoff]').count();
ok('the public places are already listed as marked', markedBefore >= 26, markedBefore + ' marked');

await page.selectOption('#ncPick', 'b28');
await page.click('#ncOn'); await page.waitForTimeout(600);
ok('marking one adds it to the list',
   await page.locator('#aBody [data-ncoff]').count() === markedBefore + 1);
await go('#/directory/b28');
body = await txt();
ok('the claim button is gone from the newly marked place', await page.locator('#claimBtn').count() === 0);
ok('the upgrade card is gone too', await page.evaluate(() =>
  !document.querySelector('[data-route^="#/subscribe"]')));
ok('it now says it is a public place', body.includes('مكان عام'));

await adminLogin();
await page.click('[data-t="dir"]'); await page.waitForTimeout(450);
await page.evaluate(() => {
  const b = Array.from(document.querySelectorAll('#aBody [data-ncoff]')).find(x => x.dataset.ncoff === 'b28');
  if (b) b.click();
});
await page.waitForTimeout(600);
await go('#/directory/b28');
ok('unmarking gives the buttons back', await page.locator('#claimBtn').count() === 1);
ok('…and a business in the same category was never touched',
   (await txt()).includes('$18 / hour'));

/* ======================================================================
   PART 5 — the importer
   ====================================================================== */
console.log('--- import ---');
await adminLogin();
await page.click('[data-t="dir"]'); await page.waitForTimeout(450);
ok('the import section explains the two optional columns',
   (await txt()).includes('noncommercial') && (await txt()).includes('entry_price'));

const sample = await grab(() => page.click('#csvSample'));
ok('the sample file carries the noncommercial column', /(^|,)noncommercial(,|$)/m.test(sample.text.split('\n')[0]));
ok('the sample file carries the entry_price column', /(^|,)entry_price(,|$)/m.test(sample.text.split('\n')[0]));
ok('the sample file shows a public place', sample.text.includes('Cedar Grove Park'));
ok('the sample file shows a ticketed one', sample.text.includes('Sky High Trampoline'));

const csv = [
  'name_en,name_ar,category,phone,address,desc_en,tags,attributes,hours_sun,hours_mon,hours_tue,hours_wed,hours_thu,hours_fri,hours_sat,noncommercial,entry_price',
  'Willow Bend Park,منتزه الصفصاف,outings,(713) 555-0777,900 Willow Bend Dr Houston TX 77025,A city park,park;حديقة,outPark;outFreeEntry;outBbq,06:00-22:00,06:00-22:00,06:00-22:00,06:00-22:00,06:00-22:00,06:00-22:00,06:00-22:00,yes,',
  'Ice Palace,,outings,(281) 555-0788,410 Katy Fwy Houston TX 77024,Ice rink,ice;تزلج,outIceSkating;outTicketed;outNotDefinedYet,11:00-21:00,11:00-21:00,11:00-21:00,11:00-21:00,11:00-21:00,11:00-22:00,11:00-22:00,,$16 / session',
  'Riverside Green,حديقة النهر,outings,(832) 555-0799,77 Riverside Dr Houston TX 77021,,park,outPark,,,,,,,,1,',
].join('\n');
const csvPath = DL + '/outings.csv';
writeFileSync(csvPath, csv, 'utf8');
await page.setInputFiles('#csvFile', csvPath);
await page.waitForTimeout(900);
body = await page.textContent('#csvOut');
ok('all three rows import', /\b3\b/.test(body) && body.includes('Willow Bend Park'));
ok('no row is refused', await page.locator('.imp-row.bad').count() === 0);
ok('the public rows are tagged non-commercial', await page.locator('.imp-tag').count() === 2,
   String(await page.locator('.imp-tag').count()));
ok('the entry price is read', body.includes('$16 / session'));
ok('an undefined speciality is a warning, not a refusal', body.includes('outNotDefinedYet'));
ok('a row with no hours is still importable', await page.locator('.imp-row.warn').count() >= 1);

const out = await grab(() => page.click('#impExport'));
ok('the emitted file marks the public places', (out.text.match(/nonCommercial: true/g) || []).length === 2,
   String((out.text.match(/nonCommercial: true/g) || []).length));
ok('the emitted file carries the entry price', out.text.includes('entryPrice: "$16 / session"'));
const willowRec = (out.text.split(/\n  \{/).find(x => x.includes('Willow Bend Park')) || '');
ok('a public row carries no entry price of its own', willowRec.includes('nonCommercial: true') && !willowRec.includes('entryPrice'));

/* ======================================================================
   PART 6 — the add / edit form
   ====================================================================== */
console.log('--- add / edit ---');
await go('#/auth/signup');
// V.02.7: one name field became two, and the password is confirmed

await page.fill('#sFirst', 'رامي');

await page.fill('#sLast', 'البي');
await page.fill('#sEmail', 'rami@arabna.app');
await page.fill('#sPass', 'Rami2026$');

await page.fill('#sPass2', 'Rami2026$');
await page.check('#agree1'); await page.check('#agree2');
await page.click('#suBtn'); await page.waitForTimeout(900);
await page.click('[data-fill="e"]'); await page.click('#vBtn'); await page.waitForTimeout(900);
await go('#/auth/phone');
await page.fill('#phIn', '(713) 466-9182');
await page.click('#sendBtn'); await page.waitForTimeout(1600);
await page.click('[data-fill="p"]'); await page.click('#vBtn'); await page.waitForTimeout(1000);

await go('#/add-business');
ok('the add form has the non-commercial checkbox', await page.locator('#bNonComm').count() === 1);
ok('the entry price is hidden for a restaurant',
   await page.evaluate(() => document.querySelector('#bEntryField').hidden));
await page.selectOption('#bCat', 'outings');
await page.waitForTimeout(350);
ok('…and appears the moment the category is an outing',
   await page.evaluate(() => !document.querySelector('#bEntryField').hidden));
const formChips = await page.locator('#bAttrs .chip').count();
ok('the form offers every outings speciality, empty ones included', formChips >= 33, formChips + ' options');
ok('including one no place carries yet', await page.evaluate(() =>
  !!document.querySelector('#bAttrs .chip[data-a="outBowling"]')));

await page.fill('#bName', 'Palm Grove Park');
await page.fill('#bNameAr', 'حديقة النخيل');
await page.fill('#bPhone', '(713) 555-0911');
await page.fill('#bAddr', '18 Palm Grove Ln, Houston, TX 77099');
await page.fill('#bEntry', '$9 / person');
await page.evaluate(() => {
  ['outPark', 'outBbq', 'outOwnFood'].forEach(id => {
    const c = document.querySelector(`#bAttrs .chip[data-a="${id}"]`);
    if (c) c.click();
  });
});
await page.check('#bNonComm');
await fillAllGroups();
await page.click('#bSave'); await page.waitForTimeout(900);
ok('the new place opens on its own page', (await page.evaluate(() => location.hash)).startsWith('#/directory/'));
body = await txt();
ok('it kept its specialities', body.includes('يوجد مكان للشواء') && body.includes('مسموح إحضار الطعام'));
ok('marked non-commercial at the door, it carries no claim invitation',
   await page.locator('#claimBtn').count() === 0 && body.includes('مكان عام'));
// the two are separate questions: a public place can still charge at a gate,
// and a business can be free to walk into
ok('a non-commercial place still prints its entry price when entry is not free',
   body.includes('$9 / person'));
ok('…but whoever entered it keeps the controls that maintain it',
   (await page.locator('[data-route^="#/business/edit/"]').count()) >= 1);
ok('…with no subscription offer beside them',
   await page.evaluate(() => !document.querySelector('[data-route^="#/subscribe"]')));

const newId = (await page.evaluate(() => location.hash)).split('/').pop();
await go('#/business/edit/' + newId);
ok('the edit form carries the same checkbox, already ticked',
   await page.evaluate(() => !!document.querySelector('#eNonComm') && document.querySelector('#eNonComm').checked));
ok('the edit form offers the entry price for an outing', await page.locator('#eEntry').count() === 1);
await page.uncheck('#eNonComm');
await page.click('#eSave'); await page.waitForTimeout(800);
body = await txt();
ok('unticking it hands the commercial surface back',
   await page.evaluate(() => !!document.querySelector('[data-route^="#/subscribe"]')));
ok('…and the owner sees their own controls, not a claim box',
   await page.locator('#claimBtn').count() === 0
   && (await page.locator('[data-route^="#/business/edit/"]').count()) >= 1);
ok('the entry price survived the edit', body.includes('$9 / person'));

/* the new place raised the count */
await go('#/directory?cat=outings');
const nowRows = await page.evaluate(() => document.querySelectorAll('#dirList .list-row[data-route^="#/directory/"]').length);
ok('the category holds one more place than it did', nowRows === outRows.length + 1,
   outRows.length + ' → ' + nowRows);

/* ======================================================================
   PART 7 — English
   ====================================================================== */
console.log('--- English ---');
await go('#/home');
await page.evaluate(() => document.querySelector('#hMenu').click()); await page.waitForTimeout(430);
await page.click('#drLang'); await page.waitForTimeout(700);
ok('the interface is left-to-right', await page.evaluate(() => document.documentElement.dir === 'ltr'));

await go('#/categories');
ok('EN: the category is named', await has('Outings & Fun'));
await go('#/directory/b26');
body = await txt();
ok('EN: free entry', body.includes('Free entry'));
ok('EN: the standing warning', body.includes('Prices and hours change'));
ok('EN: halal restaurants nearby', body.includes('Halal restaurants nearby'));
ok('EN: the public-place note', body.includes('public place'));
await go('#/directory/b28');
ok('EN: the entry price label', (await txt()).includes('Approximate entry price'));
await go('#/directory?cat=outings');
await page.click('#dirFilter'); await page.waitForTimeout(520);
labels = (await sheetAttrs()).map(a => a.label);
ok('EN: "outside food allowed"', labels.includes('Outside food allowed'), labels.slice(0, 4).join(' · '));
ok('EN: "BBQ area"', labels.includes('BBQ area'));
await page.evaluate(() => { const s = document.querySelector('.sheet-scrim'); if (s) s.click(); });
await page.waitForTimeout(400);

await go('#/home');
await page.evaluate(() => document.querySelector('#hMenu').click()); await page.waitForTimeout(430);
await page.click('#drLang'); await page.waitForTimeout(600);
ok('back to Arabic', await page.evaluate(() => document.documentElement.dir === 'rtl'));

const real = errors.filter(e => !/favicon|ERR_CONNECTION_RESET|Failed to load resource/i.test(e));
ok('no console errors', real.length === 0, real.slice(0, 4).join(' | '));

console.log(`\n${pass} passed, ${fail} failed`);
await browser.close();
process.exit(fail ? 1 : 0);
