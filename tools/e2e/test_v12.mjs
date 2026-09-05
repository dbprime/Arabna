/* V.02.1b — the phone number becomes optional */
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import { withDemoData } from './_demo.mjs';
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
/* One directory PER RUN. `run.sh` drives both builds in parallel, and a
   hard-coded path meant whichever started second ran `rmSync` over the
   file the first was about to upload — a race latent since this suite was
   written, and it surfaced the day run.sh learned to report red. The
   build is in BASE, so it is what keeps the two apart. */
const DL = '/tmp/arabna-e2e/dl12-' + (/index-single-file/.test(BASE) ? 'single' : 'main');
if (existsSync(DL)) rmSync(DL, { recursive: true });
mkdirSync(DL, { recursive: true });

let pass = 0, fail = 0;
const ok = (n, c, extra = '') => { if (c) { pass++; console.log('PASS ' + n + (extra ? ' -> ' + extra : '')); } else { fail++; console.log('FAIL ' + n + (extra ? ' -> ' + extra : '')); } };

const browser = await chromium.launch();
/* ⚠️ THIS SUITE USES THE INVENTED RECORDS AS ITS FIXTURE, and `510`
   turned them off by default. It turns them on for itself — the
   default is not reverted and no assertion is softened. */
await withDemoData(browser);
const ctx = await browser.newContext({ colorScheme: 'dark', viewport: { width: 390, height: 844 }, acceptDownloads: true });
const page = await ctx.newPage();
const errors = [];
page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
page.on('pageerror', e => errors.push('PAGEERROR ' + e.message));

const go = async (h) => {
  await page.evaluate(() => { location.hash = '#/home'; });
  await page.waitForTimeout(120);
  await page.evaluate(x => { location.hash = x; }, h);
  await page.waitForTimeout(400);
};
const txt = () => page.textContent('#app');
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
const member = async () => {
  await go('#/auth/signup');
  // V.02.7: one name field became two, and the password is confirmed

  await page.fill('#sFirst', 'أحمد');

  await page.fill('#sLast', 'سالم');
  await page.fill('#sEmail', 'ahmad@arabna.app');
  await page.fill('#sPass', 'Qamar2026$');

  await page.fill('#sPass2', 'Qamar2026$');
  await page.check('#agree1'); await page.check('#agree2');
  await page.click('#suBtn'); await page.waitForTimeout(900);
  await page.click('[data-fill="e"]'); await page.click('#vBtn'); await page.waitForTimeout(900);
  /* ⚠️ REVERSAL (475): tier 2 is reached by the EMAIL while phone
     verification is switched off, so the phone step this fixture used to
     need does not exist and is not needed. The SETUP is repaired rather
     than the subject changed — nothing below this line measures the phone. */
};

await page.goto(BASE);
await page.waitForTimeout(800);
await page.evaluate(() => {
  const s = JSON.parse(localStorage.getItem('arabna.v1') || '{}');
  s.radius = 100;
  localStorage.setItem('arabna.v1', JSON.stringify(s));
});
await page.reload(); await page.waitForTimeout(800);

/* ======================================================================
   PART 1 — the store: what blocks a row and what only marks it
   ====================================================================== */
console.log('--- the rules ---');
const head = 'name_en,name_ar,category,phone,address,desc_en,tags,attributes,'
  + 'hours_sun,hours_mon,hours_tue,hours_wed,hours_thu,hours_fri,hours_sat,noncommercial,entry_price';
const csv = [
  head,
  // no phone at all: must import, with a warning
  'Willow Bend Park,منتزه الصفصاف,outings,,"900 Willow Bend Dr, Houston, TX 77025",A city park,park,outPark;outFreeEntry,06:00-22:00,06:00-22:00,06:00-22:00,06:00-22:00,06:00-22:00,06:00-22:00,06:00-22:00,1,',
  // a different phoneless place: NOT a duplicate of the one above
  'Cypress Creek Preserve,,outings,,"77 Cypress Creek Rd, Houston, TX 77070",A preserve,nature,outNature;outFreeEntry,,,,,,,,1,',
  // the same phoneless place twice: this one IS a duplicate
  'Willow Bend Park,منتزه الصفصاف,outings,,"900 Willow Bend Dr, Houston, TX 77025",A city park,park,outPark,,,,,,,,1,',
  // no phone and no address either — still importable, matches nobody
  'Türk Marketi,,grocery,,,Small Turkish grocery,turkish,,,,,,,,,,',
  // a phone that is present but wrong is still an error
  'Broken Number Cafe,,cafe,12,"5 Broken St, Houston, TX 77002",,,,,,,,,,,,',
].join('\n');
const csvPath = DL + '/nophone.csv';
writeFileSync(csvPath, csv, 'utf8');

await adminLogin();
await page.click('[data-t="dir"]'); await page.waitForTimeout(450);
await page.setInputFiles('#csvFile', csvPath);
await page.waitForTimeout(900);
let out = await page.textContent('#csvOut');

ok('a row with no phone is not refused', out.includes('Willow Bend Park'));
ok('only the row with a broken number is refused',
   await page.locator('.imp-row.bad').count() === 1,
   String(await page.locator('.imp-row.bad').count()) + ' refused');
ok('the broken number is named as the reason', out.includes('12'));
ok('"no phone number" appears in the warnings', out.includes('بلا رقم هاتف'));
ok('"no address" appears in the warnings too', out.includes('بلا عنوان'));
ok('the preview counts how many will publish with no call button',
   /بلا رقم هاتف:\s*3/.test((await page.textContent('#csvOut')).replace(/\s+/g, ' ')),
   (await page.textContent('#csvOut')).replace(/\s+/g, ' ').match(/بلا رقم هاتف[^·]{0,12}/g).join(' | '));
ok('two different phoneless places are not duplicates of each other',
   await page.locator('.imp-row.dup').count() === 1,
   String(await page.locator('.imp-row.dup').count()) + ' duplicate row(s)');
ok('…and the same phoneless row entered twice is caught, pointing at the first',
   await page.evaluate(() => {
     const dup = document.querySelector('.imp-row.dup');
     return !!dup && dup.textContent.includes('Willow Bend Park') && /#2\b/.test(dup.textContent);
   }));
ok('a place with neither phone nor address still imports', out.includes('Türk Marketi'));

const emitted = await grab(() => page.click('#impExport'));
ok('the emitted file carries the phoneless records', emitted.text.includes('Willow Bend Park'));
ok('their phone field is simply empty', /Willow Bend Park[\s\S]{0,220}phone: ""/.test(emitted.text));

/* the sample file documents the case */
const sample = await grab(() => page.click('#csvSample'));
ok('the sample file shows a place with no number',
   /Cedar Grove Park,[^,]*,outings,,/.test(sample.text), sample.text.split('\n')[3].slice(0, 60));

/* ======================================================================
   PART 2 — a listing with no number, on screen
   ====================================================================== */
console.log('--- no number, no call button ---');
await member();
await go('#/add-business');
await page.selectOption('#bCat', 'outings');
await page.waitForTimeout(300);
ok('the form marks the phone optional', (await txt()).includes('اتركه فارغاً إذا لم يكن للمكان رقم منشور'));
await page.fill('#bName', 'Silent Creek Park');
await page.fill('#bNameAr', 'حديقة الجدول');
await page.fill('#bAddr', '55 Silent Creek Dr, Houston, TX 77080');
await page.evaluate(() => {
  const c = document.querySelector('#bAttrs .chip[data-a="outPark"]');
  if (c) c.click();
});
await fillAllGroups();
await page.click('#bSave'); await page.waitForTimeout(900);
ok('a business saves with no phone at all',
   (await page.evaluate(() => location.hash)).startsWith('#/directory/'), await page.evaluate(() => location.hash));

let body = await txt();
const newId = (await page.evaluate(() => location.hash)).split('/').pop();
ok('no call button on its page', await page.locator('#callBtn').count() === 0);
ok('the directions button is still there', await page.locator('#mapBtn').count() === 1);
ok('the quiet line stands where the number would be', body.includes('لا يوجد رقم — استخدم الاتجاهات'));
ok('the address is still printed', body.includes('55 Silent Creek Dr'));
ok('the single button takes the full width', await page.evaluate(() => {
  const g = document.querySelector('.action-grid');
  return g && getComputedStyle(g).gridTemplateColumns.split(' ').length === 1;
}));

await go('#/directory?cat=outings');
ok('no call button on its row card either', await page.evaluate((id) => {
  const row = document.querySelector(`#dirList .list-row[data-route="#/directory/${id}"]`);
  return !!row && !row.querySelector('[data-call]');
}, newId));
ok('a business that does have a number keeps its call button', await page.evaluate(() => {
  const row = document.querySelector('#dirList .list-row[data-route="#/directory/b28"]');
  return !!row && !!row.querySelector('[data-call]');
}));
ok('the phoneless place is listed like any other', (await txt()).includes('حديقة الجدول'));

/* a normal listing is untouched */
await go('#/directory/b1');
body = await txt();
ok('a listing with a number still calls', await page.locator('#callBtn').count() === 1);
ok('…and prints it', body.includes('(713) 555-0142'));
ok('…and shows no "no number" line', !body.includes('لا يوجد رقم'));
ok('…and keeps both buttons side by side', await page.evaluate(() => {
  const g = document.querySelector('.action-grid');
  return g && getComputedStyle(g).gridTemplateColumns.split(' ').length === 2;
}));

/* editing keeps it optional, and adding a number brings the button back */
await go('#/business/edit/' + newId);
ok('the edit form marks the phone optional too', (await txt()).includes('اتركه فارغاً'));
await page.fill('#ePhone', '(713) 555-0922');
await page.click('#eSave'); await page.waitForTimeout(800);
ok('adding a number brings the call button back', await page.locator('#callBtn').count() === 1);
ok('…and the "no number" line is gone', !(await txt()).includes('لا يوجد رقم'));

/* ======================================================================
   PART 3 — English
   ====================================================================== */
console.log('--- English ---');
await go('#/home');
await page.evaluate(() => document.querySelector('#hMenu').click()); await page.waitForTimeout(430);
await page.click('#drLang'); await page.waitForTimeout(700);

await go('#/business/edit/' + newId);
await page.fill('#ePhone', '');
await page.click('#eSave'); await page.waitForTimeout(800);
body = await txt();
ok('EN: the quiet line', body.includes('No number — use directions'));
ok('EN: still no call button', await page.locator('#callBtn').count() === 0);
await go('#/add-business');
ok('EN: the form marks the phone optional', (await txt()).includes('Leave it blank when the place has no published number'));

await adminLogin();
await page.click('[data-t="dir"]'); await page.waitForTimeout(450);
await page.setInputFiles('#csvFile', csvPath);
await page.waitForTimeout(900);
out = await page.textContent('#csvOut');
ok('EN: "no phone number" in the preview', out.includes('no phone number'));
ok('EN: "no address" in the preview', out.includes('no address'));

await go('#/home');
await page.evaluate(() => document.querySelector('#hMenu').click()); await page.waitForTimeout(430);
await page.click('#drLang'); await page.waitForTimeout(600);
ok('back to Arabic', await page.evaluate(() => document.documentElement.dir === 'rtl'));

const real = errors.filter(e => !/favicon|ERR_CONNECTION_RESET|Failed to load resource/i.test(e));
ok('no console errors', real.length === 0, real.slice(0, 4).join(' | '));

console.log(`\n${pass} passed, ${fail} failed`);
await browser.close();
process.exit(fail ? 1 : 0);
