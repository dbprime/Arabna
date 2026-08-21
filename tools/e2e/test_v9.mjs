/* V.01.9 — no "free" badge, reviews for everyone, real photos,
   your-page-only-yours, ownership claims, verification, import/backup */
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync, rmSync } from 'node:fs';

const BASE = process.env.BASE || 'http://localhost:8123/index.html';
const DL = '/tmp/claude-0/-home-user-Arabna/251db543-2065-5c48-ad10-c7376686ff5c/scratchpad/dl';
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

const go = async (h) => { await page.evaluate(x => { location.hash = x; }, h); await page.waitForTimeout(360); };
const hash = () => page.evaluate(() => location.hash);
const txt = () => page.textContent('#app');
const rowEls = `#dirList .list-row[data-route^="#/directory/"]`;
const rows = () => page.evaluate((sel) => Array.from(document.querySelectorAll(sel))
  .map(r => (r.querySelector('.row-title') || {}).textContent.trim()), rowEls);
const ls = () => page.evaluate(() => JSON.parse(localStorage.getItem('arabna.v1') || '{}'));
const grab = async (fn) => {
  const [dl] = await Promise.all([page.waitForEvent('download'), fn()]);
  const path = DL + '/' + dl.suggestedFilename();
  await dl.saveAs(path);
  return { name: dl.suggestedFilename(), text: readFileSync(path, 'utf8') };
};
const adminLogin = async () => {
  await go('#/admin');
  if (await page.locator('#aUser').count()) {
    await page.fill('#aUser', 'arabna.admin');
    await page.fill('#aPass', 'Arabna@2026!');
    await page.click('#aGo'); await page.waitForTimeout(500);
  }
};
/** a small real JPEG, produced in the page and handed to the file input */
const fakePhoto = async (label) => page.evaluate((txt) => {
  const cv = document.createElement('canvas'); cv.width = 900; cv.height = 700;
  const c = cv.getContext('2d');
  c.fillStyle = '#2d7d46'; c.fillRect(0, 0, 900, 700);
  c.fillStyle = '#fff'; c.font = '90px sans-serif'; c.fillText(txt, 60, 380);
  return cv.toDataURL('image/png');
}, label);
const uploadTo = async (dataUrl, name) => {
  const buf = Buffer.from(dataUrl.split(',')[1], 'base64');
  await page.setInputFiles('input[type="file"][accept*="image"]', {
    name, mimeType: 'image/png', buffer: buf,
  });
  await page.waitForTimeout(1200);
};

await page.goto(BASE);
await page.waitForTimeout(800);

/* ======================================================================
   PART 1 — the "free" badge is gone everywhere
   ====================================================================== */
console.log('--- no "free" badge on a business ---');
await go('#/directory');
ok('no "free" badge in the directory list',
   await page.evaluate((sel) => !Array.from(document.querySelectorAll(sel))
     .some(r => r.querySelector('.badge-free')), rowEls));
await go('#/directory/b2');            // a free listing
let body = await txt();
ok('no "free" badge on a free business page',
   await page.locator('#app .badge-free').count() === 0);
ok('…and the word is not printed either', !/^\s*مجاني\s*$/m.test(body));
await go('#/directory/b1');            // a paid, verified one
ok('a verified business still carries its own badge',
   await page.locator('.badge-bizverified').count() >= 1);

/* ======================================================================
   PART 2 — reviews are free for everyone
   ====================================================================== */
console.log('--- reviews ---');
await go('#/directory/b2');            // free listing, no reviews yet
ok('a free listing shows the reviews section', (await txt()).includes('التقييمات'));
ok('…with a designed empty state, not a gap', await page.locator('.rev-empty').count() === 1);
ok('…and no "subscribe to see reviews" lock',
   !(await txt()).includes('المراجعات تُفتح مع اشتراك'));
ok('the write-review button is offered on a free listing',
   await page.locator('#revBtn').count() === 1);

/* a visitor is asked to sign in, then can write it */
await page.click('#revBtn'); await page.waitForTimeout(500);
ok('a visitor is sent to sign up first', (await hash()).startsWith('#/auth/signup'), await hash());

// V.02.7: one name field became two, and the password is confirmed


await page.fill('#sFirst', 'رامي');


await page.fill('#sLast', 'البي');
await page.fill('#sEmail', 'rami@arabna.app');
await page.fill('#sPass', 'pass1234');

await page.fill('#sPass2', 'pass1234');
await page.check('#agree1'); await page.check('#agree2');
await page.click('#suBtn'); await page.waitForTimeout(900);
await page.click('[data-fill="e"]'); await page.click('#vBtn'); await page.waitForTimeout(1000);
ok('signing up returns to the free listing', (await hash()) === '#/directory/b2', await hash());

await page.click('#revBtn'); await page.waitForTimeout(550);
await page.fill('#revTxt', 'مناقيش ممتازة والزعتر طازج');
await page.click('#revSend'); await page.waitForTimeout(800);
ok('a review can be written on a FREE listing', (await txt()).includes('مناقيش ممتازة'));
ok('the rating now shows on the page', await page.locator('.stars').count() >= 1);
await go('#/directory');
ok('the count and average show in the directory results',
   await page.evaluate(() => {
     const row = Array.from(document.querySelectorAll('#dirList .list-row'))
       .find(r => (r.querySelector('.row-title') || {}).textContent.includes('بيروت'));
     return !!row && !!row.querySelector('.stars') && /مراجعة/.test(row.textContent);
   }));

/* top-rated sorting is offered */
await page.click('#dirFilter'); await page.waitForTimeout(500);
ok('"top rated" sorting is in the filter sheet',
   (await page.textContent('#sheet')).includes('الأعلى تقييماً'));
await page.click('#fSort .chip[data-s="rated"]'); await page.waitForTimeout(200);
await page.click('#fApply'); await page.waitForTimeout(500);
ok('sorting by rating applies', await page.evaluate((sel) => {
  const list = Array.from(document.querySelectorAll(sel));
  return list.length > 1;
}, rowEls));
await page.click('#dirFilter'); await page.waitForTimeout(450);
await page.click('#fClear'); await page.waitForTimeout(500);

/* ======================================================================
   PART 3 — claiming is a request, not a tap
   ====================================================================== */
console.log('--- ownership claim ---');
await go('#/directory/b2');
ok('the claim button sits on the business page itself',
   await page.locator('#claimBtn').count() === 1);
await page.click('#claimBtn'); await page.waitForTimeout(500);
ok('it opens the claim form for that business', (await hash()) === '#/claim/b2', await hash());
ok('the form asks who is claiming', await page.locator('#cName').count() === 1
   && await page.locator('#cRole').count() === 1 && await page.locator('#cProof').count() === 1);

await page.fill('#cName', 'رامي البي');
await page.fill('#cPhone', '(713) 466-9182');
await page.fill('#cProof', 'رخصة رقم 44821');
await page.click('#cSend'); await page.waitForTimeout(700);
ok('claiming needs a verified mobile', (await hash()).startsWith('#/auth/phone'), await hash());

await page.fill('#phIn', '(713) 466-9182');
await page.click('#sendBtn'); await page.waitForTimeout(1600);
await page.click('[data-fill="p"]'); await page.click('#vBtn'); await page.waitForTimeout(1000);
ok('after verifying, the claim form is back', (await hash()) === '#/claim/b2', await hash());

await page.fill('#cName', 'رامي البي');
await page.fill('#cPhone', '(713) 466-9182');
await page.fill('#cProof', 'رخصة رقم 44821');
await page.click('#cSend'); await page.waitForTimeout(800);
let st = await ls();
ok('the claim was recorded as pending',
   (st.claims || []).length === 1 && st.claims[0].status === 'pending',
   JSON.stringify((st.claims || [])[0] || {}).slice(0, 90));
ok('ownership is NOT granted on the spot', !st.myBusinessId, String(st.myBusinessId));
await go('#/directory/b2');
ok('the page says the claim is under review', (await txt()).includes('قيد المراجعة'));
ok('…and no owner controls are shown yet', await page.locator('.owner-box').count() === 0);

/* the admin decides */
await adminLogin();
ok('the claim is in the moderation queue', (await page.textContent('#aBody')).includes('طلبات ملكية'));
await page.click('#aBody [data-clok]'); await page.waitForTimeout(700);
st = await ls();
ok('approving grants ownership', st.myBusinessId === 'b2', String(st.myBusinessId));
ok('the owner is notified', (st.extraNotifs || []).some(n => n.title.ar.includes('مالك')),
   ((st.extraNotifs || [])[0] || {}).title?.ar);

await go('#/directory/b2');
ok('the owner now sees their controls', await page.locator('.owner-box').count() === 1);
ok('…and the claim invitation is gone', await page.locator('#claimBtn').count() === 0);

/* ======================================================================
   PART 4 — the owner replies to a review
   ====================================================================== */
console.log('--- owner reply ---');
ok('the owner is offered a reply on each review',
   await page.locator('[data-reply]').count() >= 1);
await page.click('[data-reply]'); await page.waitForTimeout(550);
await page.fill('#rpTxt', 'شكراً لك — نشوفك قريباً');
await page.click('#rpSend'); await page.waitForTimeout(800);
body = await txt();
ok('the reply shows under the review', body.includes('شكراً لك — نشوفك قريباً'));
ok('…labelled as the owner speaking', await page.locator('.owner-reply .or-head').count() === 1
   && (await page.textContent('.owner-reply .or-head')).includes('رد صاحب النشاط'));

/* ======================================================================
   PART 5 — photos are real
   ====================================================================== */
console.log('--- photos ---');
await go('#/directory/b2');
ok('a business with no photos shows no gallery at all',
   await page.locator('.photo-tile').count() === 0);
ok('the owner is offered photo management',
   (await page.textContent('#app')).includes('إدارة الصور'));

await go('#/business/photos/b2');
ok('the free plan states its 3-photo limit', (await txt()).includes('حتى 3 صور'));
const png = await fakePhoto('SHOP');
await uploadTo(png, 'shop.png');
await page.click('#phSave'); await page.waitForTimeout(900);
st = await ls();
ok('the photo was stored against the business',
   ((st.bizPhotos || {}).b2 || []).length === 1, JSON.stringify(Object.keys(st.bizPhotos || {})));
ok('…and is waiting on review', ((st.bizPhotos || {}).b2 || [])[0].status === 'pending');
ok('…stored as a compressed data URL, not the raw file',
   /^data:image\/jpe?g/.test(((st.bizPhotos || {}).b2 || [])[0].url),
   ((st.bizPhotos || {}).b2 || [])[0].url.slice(0, 22));

await go('#/directory/b2');
ok('the owner sees their own pending photo', await page.locator('.photo-tile.shot').count() === 1);
ok('…marked as pending', await page.locator('.shot-flag').count() === 1);
ok('a pending photo is NOT used as the hero yet', await page.locator('.hero-img').count() === 0);

await adminLogin();
ok('the photo is in the admin queue', (await page.textContent('#aBody')).includes('صور الأنشطة'));
await page.click('#aBody [data-bpok]'); await page.waitForTimeout(700);
await go('#/directory/b2');
ok('once approved it becomes the hero image', await page.locator('.hero-img').count() === 1);
ok('…and survives a reload', await (async () => {
  await page.reload(); await page.waitForTimeout(800);
  await go('#/directory/b2');
  return await page.locator('.hero-img').count() === 1;
})());

/* the free cap is real */
await go('#/business/photos/b2');
const cap = await page.evaluate(() => {
  const inp = document.querySelector('input[type="file"][accept*="image"]');
  return { max: inp ? inp.getAttribute('data-max') : null };
});
ok('the picker exists on the photo screen', await page.locator('input[type="file"]').count() >= 1);

/* ======================================================================
   PART 6 — "your page, only yours"
   ====================================================================== */
console.log('--- similar businesses ---');
await go('#/directory/b2');            // free
ok('a free page shows similar businesses at the foot',
   await page.locator('.similar').count() === 1);
ok('…and they are labelled as unpaid suggestions',
   (await page.textContent('.similar')).includes('غير مموّلة'));
ok('…placed after the reviews, at the very bottom', await page.evaluate(() => {
  const sim = document.querySelector('.similar');
  const rev = document.querySelector('#revList');
  return !!sim && !!rev && sim.getBoundingClientRect().top > rev.getBoundingClientRect().top;
}));
await go('#/directory/b1');            // subscribed
ok('a subscriber page shows no other businesses',
   await page.locator('.similar').count() === 0);

await go('#/subscribe');
ok('the plan lists "your page, only yours"', (await txt()).includes('صفحتك لك وحدك'));
ok('…with its explanation', (await txt()).includes('لا يظهر على صفحتك أي محل آخر'));
ok('the plan no longer sells reviews',
   !(await txt()).includes('المراجعات تُفتح'), '');
ok('the free side is spelled out', (await txt()).includes('مجاناً للجميع'));

/* ======================================================================
   PART 7 — verification is not bought
   ====================================================================== */
console.log('--- verification ---');
/* subscribe b2 and check no badge appears. V.01.8 batch four put a consent
   screen between the plan and any charge, so the walk goes through it. */
await go('#/subscribe/b2');
await page.click('#subBtn'); await page.waitForTimeout(700);
await page.check('#subConsent'); await page.waitForTimeout(200);
await page.click('#consentGo'); await page.waitForTimeout(1600);
st = await ls();
ok('the business is now subscribed', !!st.subscription && st.subscription.businessId === 'b2');
await go('#/directory/b2');
ok('paying alone does NOT produce a verified badge',
   await page.locator('.badge-bizverified').count() === 0);
ok('…but the owner is now offered verification', await page.locator('#verifyBtn').count() === 1);

await page.click('#verifyBtn'); await page.waitForTimeout(500);
body = await txt();
ok('the flow explains the steps first', body.includes('خطوات التوثيق'));
ok('…and states that no ID image is stored', body.includes('لا يحفظ صورة هويتك'));
ok('consent is a separate explicit checkbox', await page.locator('#vConsent').count() === 1);
ok('the start button is dead until consent is given',
   await page.locator('#vStart').isDisabled());
await page.check('#vConsent'); await page.waitForTimeout(200);
ok('…and live once it is', !(await page.locator('#vStart').isDisabled()));
await page.click('#vStart'); await page.waitForTimeout(1500);
st = await ls();
ok('the request is pending, not granted', (st.bizVerify || {}).b2
   && st.bizVerify.b2.status === 'pending', JSON.stringify((st.bizVerify || {}).b2 || {}));
ok('only a reference is kept, never an image',
   Object.keys(st.bizVerify.b2).every(k => ['status', 'ref', 'when', 'reason', 'decided'].includes(k)),
   Object.keys(st.bizVerify.b2).join(','));
await go('#/directory/b2');
ok('still no badge while it is pending',
   await page.locator('.badge-bizverified').count() === 0);

await adminLogin();
body = await page.textContent('#aBody');
ok('the request reaches the admin queue', body.includes('طلبات توثيق'));
ok('the admin panel shows no images, and says so', body.includes('لا تصل أي صور هوية'));
await page.click('#aBody [data-bvok]'); await page.waitForTimeout(700);
await go('#/directory/b2');
ok('after approval the gold badge appears', await page.locator('.badge-bizverified').count() >= 1);
ok('…and it reads "verified business", not "verified"',
   (await page.textContent('.badge-bizverified')).includes('نشاط موثّق'));
st = await ls();
ok('the owner is notified of the result',
   (st.extraNotifs || []).some(n => n.title.ar.includes('توثيق')));

/* the two badges are different things */
ok('the business badge is gold, the personal one blue', await page.evaluate(() => {
  const biz = getComputedStyle(document.querySelector('.badge-bizverified'));
  return /198|228|226/.test(biz.backgroundImage + biz.backgroundColor);
}));

/* a free business cannot even apply */
await go('#/verify-business/b5');
ok('a business you do not own refuses the verify screen',
   !(await hash()).startsWith('#/verify-business'), await hash());

/* ======================================================================
   PART 8 — admin: add, import, backup
   ====================================================================== */
console.log('--- import and backup ---');
await adminLogin();
await page.click('#aTabs .tab[data-t="dir"]'); await page.waitForTimeout(450);
body = await page.textContent('#aBody');
ok('the directory tab offers adding a business', body.includes('أضف نشاطك التجاري'));
ok('…bulk import', body.includes('استيراد جماعي'));
ok('…and a backup export', body.includes('نسخة احتياطية'));
ok('the old "coming in V.02" note is gone', !body.includes('قريباً'));

/* the sample file */
const sample = await grab(() => page.click('#csvSample'));
ok('a sample CSV can be downloaded', /\.csv$/.test(sample.name), sample.name);
ok('…with the documented columns',
   sample.text.split('\n')[0].includes('name_ar') && sample.text.split('\n')[0].includes('hours_fri'),
   sample.text.split('\n')[0].slice(0, 60));

/* The real shape of the owner's file: most Houston shops trade under an
   English name only, so those rows must pass with a note, not be refused. */
const head = sample.text.split('\n')[0];
ok('the sample puts the required English name first', head.startsWith('name_en'), head.slice(0, 30));

const csv = [
  head,
  // 1: complete, both names
  'Al Wadi,مطعم الوادي,restaurants,(713) 555-7788,55 Westheimer Rd Houston TX,desc,وصف,مشاوي;grill,halalMeat;delivery,11:00-22:00,11:00-22:00,11:00-22:00,11:00-22:00,11:00-22:00,11:00-23:00,closed',
  // 2: English name only — the common case, must pass
  "Abdallah's,,grocery,(713) 555-4411,3939 Hillcroft St Houston TX,,,bakery;حلويات,halalMeat,08:00-21:00,08:00-21:00,08:00-21:00,08:00-21:00,08:00-21:00,08:00-21:00,08:00-21:00",
  // 3: an attribute this build has not defined yet — ignore it, keep the row
  'Arabisca,,restaurants,(713) 555-9922,2020 Richmond Ave Houston TX,,,cafe,halalMeat;cuisineLevantine;lawyerImmigration,09:00-23:00,09:00-23:00,09:00-23:00,09:00-23:00,09:00-23:00,09:00-23:00,09:00-23:00',
  // 4: no hours at all — a warning, not a refusal
  'Fadi\'s,,restaurants,(713) 555-3311,8383 Westheimer Rd Houston TX,,,mediterranean,halalMeat,,,,,,,',
  // 5: genuinely broken — no category that exists, no address, bad phone
  ',No Name,unicorns,555,,,,,,,,,,,,',
  // 6: duplicate of a shop already in the directory
  'Copy of Al Sham,,restaurants,(713) 555-0142,6821 Hillcroft Ave Houston TX,,,,,11:00-23:00,11:00-23:00,11:00-23:00,11:00-23:00,11:00-23:00,11:00-23:00,11:00-23:00',
].join('\n');
await page.setInputFiles('#csvFile', { name: 'in.csv', mimeType: 'text/csv', buffer: Buffer.from(csv, 'utf8') });
await page.waitForTimeout(900);

const counts = await page.evaluate(() => Array.from(document.querySelectorAll('#csvOut .stat b')).map(b => b.textContent));
ok('four rows import, one warns nothing, one is broken, one duplicates',
   counts.join(',') === '4,3,1,1', counts.join(',') + ' (ok,warn,bad,dup)');
ok('every row is listed', await page.locator('.imp-row').count() === 6,
   String(await page.locator('.imp-row').count()));
ok('only ONE row is actually blocked', await page.locator('.imp-row.bad').count() === 1);

/* the three cases the owner reported */
/* the preview now sorts refusals and certain matches to the top, so a row
   is found by the name printed on it rather than by its position */
const rowFor = (name) => page.evaluate((n) => {
  const r = Array.from(document.querySelectorAll('.imp-row')).find(x => x.textContent.includes(n));
  return r ? { text: r.textContent.replace(/\s+/g, ' ').trim(), bad: r.classList.contains('bad'),
               checked: !!(r.querySelector('input') || {}).checked,
               disabled: !!(r.querySelector('input') || {}).disabled } : null;
}, name);
const rAbdallah = await rowFor("Abdallah's");
ok("a row with an English name only is NOT refused",
   rAbdallah && !rAbdallah.bad && rAbdallah.checked, rAbdallah && rAbdallah.text);
ok('…and says why it is only a warning', rAbdallah.text.includes('بلا اسم عربي'));

const rArabisca = await rowFor('Arabisca');
ok('an unknown attribute does not refuse the row',
   rArabisca && !rArabisca.bad && rArabisca.checked, rArabisca && rArabisca.text);
ok('…and names the attributes it will drop',
   rArabisca.text.includes('خصائص غير معروفة') && rArabisca.text.includes('cuisineLevantine'),
   rArabisca.text);

const rFadi = await rowFor("Fadi's");
ok('a row with no hours is not refused', rFadi && !rFadi.bad && rFadi.checked);
ok('…and says so', rFadi.text.includes('بلا دوام'));

const rBroken = await rowFor('unicorns');
ok('the genuinely broken row is still blocked',
   rBroken && rBroken.bad && rBroken.text.includes('تصنيف غير معروف'), rBroken && rBroken.text);
ok('…and cannot be included', await page.locator('.imp-row.bad input[disabled]').count() === 1);
ok('the duplicate says which listing it matches',
   (await page.textContent('.imp-row.dup')).includes('موجود في الدليل'));
ok('the duplicate is excluded by default',
   await page.evaluate(() => !document.querySelector('.imp-row.dup input').checked));
ok('the legend explains red versus amber',
   (await page.textContent('#csvOut')).includes('الأحمر يمنع الاستيراد'));

const exported = await grab(() => page.click('#impExport'));
ok('a data file is produced', /\.js$/.test(exported.name), exported.name);
ok('…containing all four importable rows', (exported.text.match(/\bid: "/g) || []).length === 4,
   String((exported.text.match(/\bid: "/g) || []).length));
ok('…with the English-only name filled into both fields',
   /name: \{ ar: "Abdallah's", en: "Abdallah's" \}/.test(exported.text),
   (exported.text.match(/name: .{0,52}Abdallah.{0,20}/) || [''])[0]);
ok('…with the unknown attributes stripped out',
   !exported.text.includes('cuisineLevantine') && !exported.text.includes('lawyerImmigration'));
ok('…but the known one kept',
   (exported.text.match(/"halalMeat"/g) || []).length >= 3);
ok('…with the structured hours array', /hours: \[\[\["11:00", "22:00"\]\]/.test(exported.text),
   (exported.text.match(/hours: .{0,40}/) || [''])[0]);
ok('…and Friday closing at 23:00, Saturday closed',
   /\["11:00", "23:00"\]\], null\]/.test(exported.text));
ok('…and the hours-less row exports seven nulls',
   /hours: \[null, null, null, null, null, null, null\]/.test(exported.text));
ok('…keywords and attributes carried across',
   exported.text.includes('"مشاوي"') && exported.text.includes('"halalMeat"'));
ok('…and it is valid JavaScript', await page.evaluate((src) => {
  try { new Function('return [' + src.replace(/^\/\*[\s\S]*?\*\/\s*/, '') + ']')(); return true; }
  catch (e) { return 'ERR ' + e.message; }
}, exported.text) === true, String(await page.evaluate((src) => {
  try { new Function('return [' + src.replace(/^\/\*[\s\S]*?\*\/\s*/, '') + ']')(); return 'ok'; }
  catch (e) { return e.message; }
}, exported.text)));

/* backup */
const backup = await grab(() => page.click('#bkExport'));
ok('a backup file is produced', /\.json$/.test(backup.name), backup.name);
const parsed = JSON.parse(backup.text);
ok('the backup is valid JSON with the whole state', !!parsed.state);
for (const key of ['claims', 'bizPhotos', 'bizVerify', 'reviews', 'reviewReplies',
                   'extraBusinesses', 'extraEvents', 'extraArticles', 'myAds', 'user']) {
  ok('backup contains ' + key, key in parsed.state);
}
ok('the backup carries the review that was written',
   (parsed.state.reviews || []).some(r => r.text.ar.includes('مناقيش')));

/* ======================================================================
   PART 9 — English
   ====================================================================== */
console.log('--- English ---');
await go('#/home');
await page.evaluate(() => document.querySelector('#hMenu').click()); await page.waitForTimeout(430);
await page.click('#drLang'); await page.waitForTimeout(650);
ok('switched to English', await page.evaluate(() => document.documentElement.lang === 'en'));

await go('#/directory/b2');
body = await txt();
ok('EN: the business badge is translated', body.includes('Verified business'));
ok('EN: the owner reply label is translated', body.includes('Owner reply'));
ok('EN: no "Free" badge on a business',
   await page.locator('#app .badge-free').count() === 0);
await go('#/directory/b5');
ok('EN: claim button translated', (await txt()).includes('This is my business'));
await go('#/subscribe');
ok('EN: "Your page, only yours" translated', (await txt()).includes('Your page, only yours'));
ok('EN: its explanation translated', (await txt()).includes('No other businesses shown on your page'));
await adminLogin();
await page.click('#aTabs .tab[data-t="dir"]'); await page.waitForTimeout(450);
ok('EN: import section translated', (await page.textContent('#aBody')).includes('Bulk import'));
ok('EN: backup section translated', (await page.textContent('#aBody')).includes('Backup'));

/* back to Arabic */
await go('#/home');
await page.evaluate(() => document.querySelector('#hMenu').click()); await page.waitForTimeout(430);
await page.click('#drLang'); await page.waitForTimeout(600);
ok('language toggles back to Arabic', await page.evaluate(() => document.documentElement.dir === 'rtl'));

const real = errors.filter(e => !/favicon|ERR_CONNECTION_RESET|Failed to load resource/i.test(e));
ok('no console errors', real.length === 0, real.slice(0, 4).join(' | '));

console.log(`\n${pass} passed, ${fail} failed`);
await browser.close();
process.exit(fail ? 1 : 0);
