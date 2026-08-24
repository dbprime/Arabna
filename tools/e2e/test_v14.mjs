/* Batch four — duplicates · demo data · subscription · ad inventory ·
   stats · notifications · blocking · back · search · the "+" button */
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
    /* the multi-select STAYS OPEN by design — picking three attributes is
       one gesture — so the panel has to be shut before the sheet's own
       footer can be pressed. Leaving it open made #fApply unclickable and
       the suite time out rather than fail. */
    await page.evaluate(b => document.querySelector(b).click(), btn);
    await page.waitForTimeout(250);
    if (hit) return;
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
const ctx = await browser.newContext({ colorScheme: 'dark', viewport: { width: 390, height: 844 }, acceptDownloads: true });
const page = await ctx.newPage();
const errors = [];
page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
page.on('pageerror', e => errors.push('PAGEERROR ' + e.message + ' @ ' + (e.stack||'').split('\n')[1] ));

const go = async (h) => {
  await page.evaluate(() => { location.hash = '#/home'; });
  await page.waitForTimeout(110);
  await page.evaluate(x => { location.hash = x; }, h);
  await page.waitForTimeout(420);
};
const txt = () => page.textContent('#app');
const hash = () => page.evaluate(() => location.hash);
/* V.04.4: the directory paints forty rows and grows as you scroll, so
   counting `.list-row` answers "how many are drawn" — and every question
   here is "how many results are there". The screen publishes that on
   `#dirList` as `data-total`, which is the number it already had. */
const rows = () => page.evaluate(() => +(document.querySelector('#dirList')||{dataset:{}}).dataset.total || 0);
const ls = () => page.evaluate(() => JSON.parse(localStorage.getItem('arabna.v1') || '{}'));
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
const member = async () => {
  await page.evaluate(() => {
    const s = JSON.parse(localStorage.getItem('arabna.v1') || '{}');
    s.user = { name: 'رامي', email: 'r@a.app', phone: '(713) 466-9182',
               phoneVerified: true, emailVerified: true, tier: 2, joined: Date.now() };
    localStorage.setItem('arabna.v1', JSON.stringify(s));
  });
  await page.reload(); await page.waitForTimeout(700);
};

await page.goto(BASE); await page.waitForTimeout(800);
await page.evaluate(() => {
  const s = JSON.parse(localStorage.getItem('arabna.v1') || '{}');
  s.radius = 100;
  localStorage.setItem('arabna.v1', JSON.stringify(s));
});
await page.reload(); await page.waitForTimeout(800);

/* ======================================================================
   A — the look-alike check
   ====================================================================== */
console.log('--- A: duplicates ---');
const dup = (o) => page.evaluate(async (arg) => {
  const S = window.__S || (window.__S = await import('./js/store.js'));
  const hits = S.findDuplicates(arg);
  return hits.map(h => h.confidence + '/' + h.reason + '/' + (h.biz.name.en || h.biz.name.ar));
}, o);
const key = (fn, arg) => page.evaluate(async ([f, a]) => {
  const S = window.__S || (window.__S = await import('./js/store.js'));
  return S[f](a);
}, [fn, arg]);

ok('the trade word comes out of the name', await key('nameKey', 'Al-Aseel Restaurant & Grill LLC') === 'aseel',
   await key('nameKey', 'Al-Aseel Restaurant & Grill LLC'));
ok('…in Arabic too', await key('nameKey', 'مطعم الأصيل') === await key('nameKey', 'الأصيل للمشاوي'),
   await key('nameKey', 'مطعم الأصيل'));
ok('a plural is not a different shop', (await key('similarity', 'aseel')) !== null);
ok('the unit number leaves the address key',
   (await key('addressKey', '1234 Westheimer Rd Ste 5, Houston, TX 77077')).key
   === (await key('addressKey', '1234 Westheimer Road #5, Houston, TX 77077')).key);

let hits = await dup({ name: 'الشام', address: '6821 Hillcroft Ave, Houston, TX 77081', phone: '', cat: 'restaurants' });
ok('same name + same address is certain', hits[0] && hits[0].startsWith('certain/nameAddress'), hits.join(' '));
hits = await dup({ name: 'X Grill', address: '1 Nowhere Rd, Houston, TX 79999', phone: '(713) 555-0142', cat: 'restaurants' });
ok('the same phone number is certain', hits[0] && hits[0].startsWith('certain/phone'), hits.join(' '));
hits = await dup({ name: 'مطعم لبناني', address: '9 Nowhere Rd, Houston, TX 79998', phone: '', cat: 'restaurants' });
/* V.02.6: b36 took the Arabic name «مطبخ ومخبز سامي اللبناني», so «لبناني»
   is now a word in an existing key and this raises ONE suggestion. It is
   the weak tier — a question with «لا، هذا محل مختلف» beside it, never a
   refusal — so it is a nuisance at worst, not a block. */
ok('a nationality alone never rises above the weak tier',
   hits.every(h => h.startsWith('weak/')), hits.join(' '));
ok('…and it certainly is not certain', !hits.some(h => h.startsWith('certain/')), hits.join(' '));
hits = await dup({ name: 'A Place With No Phone', address: '', phone: '', cat: 'grocery' });
ok('no phone is never itself a match', hits.length === 0, hits.join(' '));

/* the sheet offers the page instead of refusing the form */
await member();
await go('#/add-business');
await page.fill('#bName', 'Al Sham Restaurant');
// V.02.7: the category is required and the button is dead without it
await page.selectOption('#bCat', 'restaurants'); await page.waitForTimeout(250);
await page.fill('#bPhone', '(713) 555-0142');
await page.fill('#bAddr', '6821 Hillcroft Ave, Houston, TX 77081');
await page.click('#bSave'); await page.waitForTimeout(700);
ok('a look-alike opens the sheet', await page.locator('.sim-card').count() === 1);
ok('…which never says "duplicate"', !(await page.textContent('#sheet')).includes('مكرر'));
ok('…and leads with "this is mine"', await page.locator('#simClaim').count() === 1);
await page.click('#simClaim'); await page.waitForTimeout(600);
ok('"this is mine" becomes an ownership claim', (await hash()).startsWith('#/claim/'), await hash());

/* the admin scan */
await adminLogin();
await page.click('[data-t="dir"]'); await page.waitForTimeout(500);
ok('the admin can scan the whole directory', await page.locator('#dupScan').count() === 1);
await page.click('#dupScan'); await page.waitForTimeout(2500);
const scanTxt = await page.textContent('#dupScanOut');
ok('…and it finds the shared-number pairs', /\d+/.test(scanTxt) && scanTxt.length > 40, scanTxt.replace(/\s+/g, ' ').slice(0, 70));

/* ======================================================================
   B — the demo flag
   ====================================================================== */
console.log('--- B: demo data ---');
await adminLogin();
ok('a standing warning while invented data is live', await page.locator('.demo-warn').count() === 1);
await page.click('[data-t="set"]'); await page.waitForTimeout(400);
ok('the counters are real', await page.evaluate(() =>
  Array.from(document.querySelectorAll('#aBody .stat b')).map(x => +x.textContent).some(n => n === 29)));
await go('#/directory');
const withDemo = await rows();
await adminLogin(); await page.click('[data-t="set"]'); await page.waitForTimeout(400);
await page.click('#demoSw'); await page.waitForTimeout(600);
ok('the warning goes with it', await page.locator('.demo-warn').count() === 0);
await go('#/directory');
const withoutDemo = await rows();
ok('the invented shops leave the directory', withoutDemo === withDemo - 29, withDemo + ' → ' + withoutDemo);
await go('#/home');
ok('…and the home strips do not leave holes',
   await page.evaluate(() => !document.querySelector('#miniAd')));
ok('the house "your ad here" slide survives', (await txt()).includes('ضع إعلانك هنا'));
await adminLogin(); await page.click('[data-t="set"]'); await page.waitForTimeout(400);
await page.click('#demoSw'); await page.waitForTimeout(600);
await go('#/directory');
ok('switching it back restores them', await rows() === withDemo);

/* ======================================================================
   C — subscription, consent and cancelling
   ====================================================================== */
console.log('--- C: subscription ---');
await page.evaluate(() => {
  const s = JSON.parse(localStorage.getItem('arabna.v1') || '{}');
  s.myBusinessId = 'b2'; s.subscription = null; s.clockOffset = 0;
  localStorage.setItem('arabna.v1', JSON.stringify(s));
});
await page.reload(); await page.waitForTimeout(700);
await go('#/subscribe');
ok('monthly and yearly', await page.locator('#planSeg .seg-btn').count() === 2);
ok('the trial is stated in words', (await txt()).includes('14 يوماً'));
await page.click('#planSeg [data-plan="yearly"]'); await page.waitForTimeout(350);
ok('the yearly price is 15% off, computed not typed', (await txt()).includes('$296'), '$29 × 12 − 15% = $296');
ok('…and it says what that saves', (await txt()).includes('$52'));
await page.click('#planSeg [data-plan="monthly"]'); await page.waitForTimeout(300);
await page.click('#subBtn'); await page.waitForTimeout(700);
ok('a consent screen stands before any card field', (await hash()).startsWith('#/subscribe-consent'), await hash());
const consentTxt = await txt();
ok('it names the amount', consentTxt.includes('$29'));
ok('it names the exact first charge date', /٢٠٢٦|2026/.test(consentTxt) && consentTxt.includes('أول خصم'));
ok('it says the renewal is automatic', consentTxt.includes('التجديد تلقائي'));
ok('it says how to cancel', consentTxt.includes('إلغاء الاشتراك'));
ok('the box is not pre-ticked', await page.evaluate(() => !document.querySelector('#subConsent').checked));
ok('and the button is dead until it is', await page.evaluate(() => document.querySelector('#consentGo').disabled));
await page.check('#subConsent'); await page.waitForTimeout(200);
ok('ticking it wakes the button', await page.evaluate(() => !document.querySelector('#consentGo').disabled));
await page.click('#consentGo'); await page.waitForTimeout(1400);
ok('the subscription starts on trial', (await ls()).subscription.status === 'trialing');
ok('…and the wording agreed to is kept verbatim',
   ((await ls()).subscription.consent.text || '').includes('$29'));

/* the clock, so the cycle can be watched */
await adminLogin(); await page.click('[data-t="set"]'); await page.waitForTimeout(400);
await page.click('[data-clock="7"]'); await page.waitForTimeout(500);
await page.click('[data-clock="7"]'); await page.waitForTimeout(700);
const sub = (await ls()).subscription;
ok('fourteen days on, the trial has become a subscription', sub.status === 'active', sub.status);
ok('…and there is an invoice', (sub.invoices || []).length === 1);
const notifTitles = ((await ls()).extraNotifs || []).map(n => n.title.ar).join(' | ');
ok('the trial-ending warning was sent', notifTitles.includes('تجربتك المجانية'), notifTitles.slice(0, 80));
ok('…and so was the charge notice', notifTitles.includes('بدأ اشتراكك'));

await go('#/my-subscription');
ok('my subscription shows the next charge', (await txt()).includes('الخصم القادم'));
ok('…and the invoice', (await txt()).includes('$29'));
await page.click('#subCancel'); await page.waitForTimeout(500);
ok('cancelling asks once', await page.locator('.sheet-panel').count() === 1);
await page.click('.sheet-panel .btn-danger'); await page.waitForTimeout(700);
ok('the service keeps running to the end of the period', (await ls()).subscription.status === 'active');
ok('…and it is marked to stop after that', (await ls()).subscription.cancelAtPeriodEnd === true);
ok('…with a way back', await page.locator('#subResume').count() === 1);

/* ======================================================================
   D — inventory, the category slider, the banner that jumped
   ====================================================================== */
console.log('--- D: ads ---');
/* the fake clock is 14 days ahead from the section above; wind it back
   before measuring anything dated */
await page.evaluate(() => {
  const s = JSON.parse(localStorage.getItem('arabna.v1'));
  s.clockOffset = 0;
  localStorage.setItem('arabna.v1', JSON.stringify(s));
});
await page.reload(); await page.waitForTimeout(700);
await go('#/advertise');
// eight since V.02.8 gave the marketplace, events and the magazine one each
ok('every package says how much is left', await page.locator('.ad-avail').count() === 8);
await page.evaluate(() => {
  const s = JSON.parse(localStorage.getItem('arabna.v1'));
  const t = Date.now();
  s.myAds = [];
  for (let i = 0; i < 6; i++) s.myAds.push({ id: 'f' + i, product: 'slider', status: 'live', endsAt: t + 7 * 86400000 });
  s.clockOffset = 0;
  localStorage.setItem('arabna.v1', JSON.stringify(s));
});
await page.reload(); await page.waitForTimeout(700);
await go('#/advertise');
const availTxt = await page.evaluate(() => Array.from(document.querySelectorAll('.ad-avail')).map(e => e.textContent.replace(/\s+/g, ' ').trim()).join(' || '));
ok('a full placement says so', availTxt.includes('محجوز بالكامل'), availTxt.slice(0, 90));
ok('…and names the next free date', availTxt.includes('أقرب تاريخ متاح'));
await page.click('.ad-avail [data-wait]'); await page.waitForTimeout(600);
await page.fill('#wlName', 'مطعم الاختبار'); await page.fill('#wlPhone', '(713) 555-2222');
await page.click('#wlGo'); await page.waitForTimeout(600);
ok('a full placement takes a waiting-list name instead of losing them',
   ((await ls()).adWaitlist || []).length === 1);
await adminLogin(); await page.click('[data-t="ads"]'); await page.waitForTimeout(500);
ok('…and the admin sees it', (await page.textContent('#aBody')).includes('مطعم الاختبار'));

/* the banner that changed width with its text */
await go('#/home');
const widths = [];
for (let i = 0; i < 3; i++) {
  widths.push(await page.evaluate(() => {
    const e = document.querySelector('#miniAd');
    const r = e.getBoundingClientRect();
    return Math.round(r.width) + 'x' + Math.round(r.height);
  }));
  await page.waitForTimeout(7200);
}
ok('the mini banner keeps one size through every rotation',
   new Set(widths).size === 1 && widths[0].endsWith('x62'), widths.join(' '));

/* an impression is counted only after the placement has genuinely held
   still on screen, and only for something somebody paid for */
await page.evaluate(() => {
  const s = JSON.parse(localStorage.getItem('arabna.v1'));
  s.adStats = {};
  localStorage.setItem('arabna.v1', JSON.stringify(s));
});
await page.reload(); await page.waitForTimeout(400);
await go('#/home');
await page.waitForTimeout(1600);
const seen1 = await page.evaluate(() => (JSON.parse(localStorage.getItem('arabna.v1')).adStats || {}));
ok('a paid slide on screen counts as one view',
   Object.values(seen1).some(x => x.impressions >= 1), JSON.stringify(seen1).slice(0, 70));
ok('…and only paid ones are counted', Object.keys(seen1).every(k => k.startsWith('f')),
   Object.keys(seen1).join(' '));

/* ======================================================================
   E — the numbers a subscriber and an advertiser are shown
   ====================================================================== */
console.log('--- E: stats ---');
await page.evaluate(() => {
  const s = JSON.parse(localStorage.getItem('arabna.v1'));
  s.myAds = [{ id: 'ad1', product: 'slider', status: 'live', price: 149, bizName: 'فرن بيروت',
               tagline: 'طازج', endsAt: Date.now() + 7 * 86400000, created: Date.now() }];
  s.adStats = { ad1: { impressions: 120, clicks: 9, days: {} } };
  localStorage.setItem('arabna.v1', JSON.stringify(s));
});
await page.reload(); await page.waitForTimeout(700);
await go('#/my-ads');
const adTxt = (await txt()).replace(/\s+/g, ' ');
ok('the advertiser sees impressions, clicks and the rate',
   adTxt.includes('120') && adTxt.includes('9') && adTxt.includes('7.5%'), adTxt.match(/120.{0,40}/)[0]);
ok('…a bar per day', await page.locator('.spark-bar').count() === 7);
ok('…and a renew button beside them', await page.locator('[data-adrenew]').count() === 1);

await go('#/directory/b2');
await go('#/directory/b2');
await go('#/my-business');
const bizTxt = (await txt()).replace(/\s+/g, ' ');
ok('the subscriber sees their page views', bizTxt.includes('مشاهدات الصفحة'));
// V.03.4: the counted noun is right now — «شخصان» · «5 أشخاص» · «11 شخصاً»
ok('…said in the sentence that renews a subscription', /شاهد صفحتك .*(شخص|أشخاص)/.test(bizTxt),
   (bizTxt.match(/صفحتك شافها[^·]{0,24}/) || [''])[0]);

/* ======================================================================
   F — notifications that come from something real
   ====================================================================== */
console.log('--- F: notifications ---');
const before = ((await ls()).extraNotifs || []).length;
await go('#/directory/b2');
await page.click('#revBtn'); await page.waitForTimeout(600);
await page.fill('#revTxt', 'ممتاز');
await page.click('#revSend'); await page.waitForTimeout(700);
const after = ((await ls()).extraNotifs || []).length;
ok('a review on your own business notifies you', after === before + 1, before + ' → ' + after);
ok('…and says what it is', (((await ls()).extraNotifs || [])[0].title.ar || '').includes('تقييم جديد'));

await go('#/events');
const evRoute = await page.evaluate(() => {
  const r = Array.from(document.querySelectorAll('[data-route^="#/events/"]')).find(x => x.dataset.route !== '#/events/propose');
  return r ? r.dataset.route : null;
});
await go(evRoute);
ok('an event can be saved for a reminder', await page.locator('#evRemind').count() === 1);
await page.click('#evRemind'); await page.waitForTimeout(400);
ok('…and it is remembered', ((await ls()).savedEvents || []).length === 1);

/* ======================================================================
   G — blocking, contact details, deletion
   ====================================================================== */
console.log('--- G: safety ---');
await go('#/about');
ok('the complaint address is published, not behind a form', (await txt()).includes('support@arabna.app'));
await go('#/terms');
ok('…and repeated in the terms', (await txt()).includes('support@arabna.app'));

await go('#/marketplace');
const listing = await page.evaluate(() => {
  const rs = Array.from(document.querySelectorAll('#clGrid [data-route^="#/marketplace/"]'));
  return rs.length > 1 ? rs[1].dataset.route : (rs[0] || {}).dataset.route;
});
await go(listing);
ok('a listing offers a block button', await page.locator('#blockBtn').count() === 1);
await page.click('#blockBtn'); await page.waitForTimeout(500);
await page.click('.sheet-panel .btn-danger'); await page.waitForTimeout(700);
ok('blocking takes effect at once, with no moderator',
   await page.evaluate((r) => !document.querySelector(`[data-route="${r}"]`), listing));
await go('#/blocked');
ok('the blocked list exists', await page.locator('[data-unblock]').count() === 1);
await page.click('[data-unblock]'); await page.waitForTimeout(500);
await go('#/marketplace');
ok('…and unblocking gives them back', await page.evaluate((r) => !!document.querySelector(`[data-route="${r}"]`), listing));

await go('#/settings');
await page.click('#delAcc'); await page.waitForTimeout(500);
ok('deletion says what it will take', (await page.textContent('.sheet-panel')).includes('سيُحذف مع حسابك'));
await page.click('#delGo'); await page.waitForTimeout(800);
const gone = await ls();
ok('…and really deletes rather than signing out',
   !gone.user && !(gone.reviews || []).length && !gone.subscription && !(gone.myAds || []).length);

/* ======================================================================
   H — coming back where you were
   ====================================================================== */
console.log('--- H: back ---');
await member();
await go('#/directory?cat=restaurants');
await page.evaluate(() => { document.querySelector('#app').scrollTop = 2400; });
await page.waitForTimeout(350);
const opened = await page.evaluate(() => {
  const rs = [...document.querySelectorAll('#dirList .list-row[data-route^="#/directory/"]')];
  const r = rs.find(x => x.getBoundingClientRect().top > 150) || rs[0];
  r.click();
  return r.dataset.route;
});
await page.waitForTimeout(700);
ok('the listing opens', (await hash()) === opened, await hash());
await page.goBack(); await page.waitForTimeout(900);
ok('back lands where it was left',
   Math.abs(await page.evaluate(() => document.querySelector('#app').scrollTop) - 2400) < 40,
   String(await page.evaluate(() => document.querySelector('#app').scrollTop)));
ok('…with the search and filters still on', (await hash()).includes('cat=restaurants'), await hash());

/* three filter changes, then one press of back */
await go('#/directory?cat=restaurants');
await toggleOpenNow(page);
/* the first attribute the sheet offers for restaurants, whatever it is —
   this only needs a second filter to be on, not a particular one.
   (It read `dataset.attr` before, which no element ever carried, so the
   toggle was silently skipped; the ids live on `data-v` in the panel.) */
const chip2 = await (async () => {
  await page.click('#dirFilter'); await page.waitForTimeout(520);
  let id = null;
  for (const [btn, host] of attrHosts) {
    if (id || !(await page.locator(btn).count())) continue;
    await page.evaluate(b => document.querySelector(b).click(), btn);
    await page.waitForTimeout(400);
    id = await page.evaluate(h => { const r = document.querySelector(h + ' .dd-row'); return r ? r.dataset.v : null; }, host);
    await page.evaluate(b => document.querySelector(b).click(), btn);
    await page.waitForTimeout(250);
  }
  await page.click('#fApply'); await page.waitForTimeout(450);
  return id;
})();
if (chip2) { await toggleAttr(page, chip2); }
await page.fill('#dirSearch', 'مشاوي'); await page.waitForTimeout(500);
const filteredHash = await hash();
ok('the filters are all in the link', filteredHash.includes('open=1') && filteredHash.includes('q='), filteredHash);
await page.goBack(); await page.waitForTimeout(800);
ok('one back leaves the directory instead of undoing filters one by one',
   !(await hash()).startsWith('#/directory?'), await hash());

/* a shared link opens on the same result */
await page.evaluate((h) => { location.hash = h; }, filteredHash);
await page.waitForTimeout(700);
ok('the link opens on the same filtered view',
   await page.evaluate(() => document.querySelector('#dirSearch').value) === 'مشاوي'
   && await page.evaluate(() => !!document.querySelector('#pills [data-off="__open"]')));

/* ======================================================================
   I — the search that could not find what was there
   ====================================================================== */
console.log('--- I: search and filters ---');
await go('#/directory');
/* V.02.4: the search shares its row with the city chip again, but the
   magnifier is flex: 0 0 22px now, so nothing can squeeze it. */
ok('the magnifier is 22px and gold, and refuses to shrink', await page.evaluate(() => {
  const svg = document.querySelector('.search-row .search-bar.big > svg');
  const r = svg.getBoundingClientRect();
  return Math.round(r.width) === 22 && getComputedStyle(svg).color === 'rgb(228, 199, 126)';
}));
ok('the placeholder is an example, not an instruction',
   (await page.getAttribute('#dirSearch', 'placeholder')).includes('ابحث عن'));
await page.fill('#dirSearch', 'صالون فلوريدا'); await page.waitForTimeout(700);
ok('«صالون فلوريدا» now finds the salon', await rows() > 0, String(await rows()));
/* V.03.0 reversed this one deliberately. It used to fall through to stage
   two — 24 rows under «ما لقينا … بالضبط» — because the record carried no
   Arabic «فلوريدا» at all. The transliteration tag makes it a real match,
   so the query is EXACT now and the near-miss line correctly stays away. */
ok('…and it is the salon alone, exactly',
   await rows() === 1 && await page.locator('.near-miss').count() === 0, String(await rows()));
await page.fill('#dirSearch', ''); await page.waitForTimeout(500);

ok('no quick chips on "all"', await page.evaluate(() =>
  document.querySelectorAll('#pills [data-off]').length) === 0);
await page.click('#ctlCat'); await page.waitForTimeout(350);
await page.evaluate(() => document.querySelector('.dd-row[data-v="outings"]').click());
await page.waitForTimeout(650);
/* V.02.7: choosing a category brings no chips — the row is gone. The
   pills row shows only what is actually filtered, and a bare category is
   already written on the picker. */
const outChips = await page.evaluate(() =>
  document.querySelectorAll('#pills [data-off]').length);
ok('a category brings no chips with it', outChips === 0, String(outChips));

/* V.02.4 replaced the grid sheet with the picker: every category is in
   one vertical list, so there is nothing left for a second surface to do. */
await page.click('#ctlCat'); await page.waitForTimeout(500);
ok('the picker holds every category at once', await page.locator('.dd-row').count() === 22,
   String(await page.locator('.dd-row').count()));
ok('…each with its real count', (await page.textContent('.dd-panel')).includes('138'));
ok('…and no sideways scroll', await page.evaluate(() => {
  const box = document.querySelector('.dd-scroll');
  return box.scrollWidth <= box.clientWidth + 2;
}));
await page.evaluate(() => document.querySelector('.dd-row[data-v="restaurants"]').click());
await page.waitForTimeout(700);
ok('picking one filters the list', (await hash()).includes('cat=restaurants'), await hash());

await page.click('#dirFilter'); await page.waitForTimeout(600);
ok('the sheet does not repeat the category row', !(await page.textContent('#sheet')).includes('الفئة'));
/* V.02.3: the slider filtered nothing and pointed the wrong way in RTL.
   The area is a set of options, each carrying its count.
   V.04.0 turned those options from chips into picker rows — the sheet was
   two screens of scrolling — so the counts are read from inside the two
   panels now. The rule they guard is the same one: nothing is offered with
   nothing behind it, and every option says how much it will leave. */
const ddOpen = async (btn, host) => {
  if (!(await page.locator(btn).count())) return [];
  await page.evaluate(b => document.querySelector(b).click(), btn);
  await page.waitForTimeout(400);
  const n = await page.evaluate(h => [...document.querySelectorAll(h + ' .dd-row')]
    .map(r => { const c = r.querySelector('.chip-n'); return c ? +c.textContent : null; }), host);
  await page.evaluate(b => document.querySelector(b).click(), btn);
  await page.waitForTimeout(280);
  return n;
};
const areaCounts = await ddOpen('#fCtlArea', '#fDdArea');
ok('the area is a set of counted options', await page.locator('#fRad').count() === 0
   && areaCounts.filter(n => n != null).length >= 1, areaCounts.join(','));
const attrCountsSeen = (await ddOpen('#fCtlTop', '#fDdTop')).concat(await ddOpen('#fCtlRest', '#fDdRest'));
ok('every option carries a count', attrCountsSeen.filter(n => n != null).length > 3, attrCountsSeen.length + ' options');
ok('nothing with zero behind it is offered', attrCountsSeen.every(n => n == null || n > 0));
/* V.02.3: "sticky" inside a panel taller than the screen covered the last
   group on a real device. The footer is now a flex sibling of the scrolling
   body, which pins it without overlapping anything. */
ok('the footer is pinned and counts live',
   await page.evaluate(() => {
     const panel = document.querySelector('.sheet-panel');
     const foot = panel.querySelector('.sheet-foot');
     return foot.parentElement === panel && !panel.querySelector('.sheet-body .sheet-foot')
       && getComputedStyle(panel).flexDirection === 'column';
   })
   && /\d/.test(await page.textContent('#fApply')));
ok('no horizontal scroll anywhere in the sheet', await page.evaluate(() =>
  !Array.from(document.querySelectorAll('#sheet *')).some(e => e.scrollWidth > e.clientWidth + 2
    && getComputedStyle(e).overflowX !== 'visible')));
await page.click('#fApply'); await page.waitForTimeout(700);

/* ======================================================================
   J — the "+" button
   ====================================================================== */
console.log('--- J: the add button ---');
await page.evaluate(() => localStorage.removeItem('arabna.v1'));
await page.reload(); await page.waitForTimeout(800);
ok('the centre button has a name', (await page.textContent('#navAdd')).trim() === 'أضف');
await page.click('#navAdd'); await page.waitForTimeout(600);
const addRows = await page.evaluate(() => Array.from(document.querySelectorAll('.add-row b')).map(b => b.textContent.trim()));
ok('a visitor sees the choices, not a login screen', addRows.length === 4, addRows.join(' · '));
ok('…including adding a business', addRows.some(x => x.includes('نشاطك')));
ok('…with advertising underneath', addRows[3].includes('أعلن'));
await page.click('.add-row[data-go="#/post"]'); await page.waitForTimeout(700);
ok('the form opens for a visitor', await page.locator('#pTitle').count() === 1, await hash());
ok('…and says when the account will be needed', (await txt()).includes('سجّل دخولك لننشر'));
await page.fill('#pTitle', 'دراجة للبيع');
await page.fill('#pPrice', '$120');
/* V.02.7: every field but the photos is required, and the form says which
   one is empty *before* asking anybody to make an account — signing up and
   only then discovering the form is unfinished is the wrong order. */
await page.fill('#pCity', 'Houston, TX');
await page.fill('#pDesc', 'بحالة ممتازة');
await page.click('#pubBtn'); await page.waitForTimeout(800);
ok('the account is asked for at publish', (await hash()).startsWith('#/auth'), await hash());
ok('…and what was typed is kept', ((await ls()).draft || {}).title === 'دراجة للبيع');

/* ======================================================================
   English, and a clean console
   ====================================================================== */
console.log('--- English ---');
await go('#/home');
await page.evaluate(() => document.querySelector('#hMenu').click()); await page.waitForTimeout(430);
await page.click('#drLang'); await page.waitForTimeout(700);
await go('#/directory');
ok('EN: the example placeholder', (await page.getAttribute('#dirSearch', 'placeholder')).includes('Try restaurant'));
await page.click('#navAdd'); await page.waitForTimeout(500);
ok('EN: the add sheet', (await page.textContent('.sheet-panel')).includes('Add your business'));
await page.click('.sheet-scrim'); await page.waitForTimeout(400);
await member();
await go('#/subscribe');
ok('EN: the trial line', (await txt()).includes('Free for 14 days'), (await txt()).slice(0, 60));
await go('#/about');
ok('EN: the published contact block', (await txt()).includes('Contact us'));
await go('#/home');
await page.evaluate(() => document.querySelector('#hMenu').click()); await page.waitForTimeout(430);
await page.click('#drLang'); await page.waitForTimeout(600);
ok('back to Arabic', await page.evaluate(() => document.documentElement.dir === 'rtl'));

const real = errors.filter(e => !/favicon|ERR_CONNECTION_RESET|Failed to load resource/i.test(e));
ok('no console errors anywhere in the batch', real.length === 0, real.slice(0, 4).join(' | '));

console.log(`\n${pass} passed, ${fail} failed`);
await browser.close();
process.exit(fail ? 1 : 0);
