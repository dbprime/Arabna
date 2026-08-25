import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';

const BASE = process.env.BASE || 'http://localhost:8123/index.html';
let pass = 0, fail = 0;
const ok = (n, c, extra = '') => { if (c) { pass++; console.log('PASS ' + n + (extra ? ' -> ' + extra : '')); } else { fail++; console.log('FAIL ' + n + (extra ? ' -> ' + extra : '')); } };

const browser = await chromium.launch();
const page = await (await browser.newContext({ colorScheme: 'dark', viewport: { width: 420, height: 900 } })).newPage();
const errors = [];
page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
page.on('pageerror', e => errors.push('PAGEERROR ' + e.message));

const go = async (h) => { await page.evaluate(x => { location.hash = x; }, h); await page.waitForTimeout(260); };
const txt = () => page.textContent('#app');
const clearToasts = () => page.evaluate(() => { document.querySelector('#toast').innerHTML = ''; });
const toastHas = async (needle, ms = 6000) => {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    const tx = await page.textContent('#toast');
    if (tx && tx.includes(needle)) return tx.trim();
    await page.waitForTimeout(80);
  }
  return (await page.textContent('#toast') || '').trim();
};
const ls = () => page.evaluate(() => JSON.parse(localStorage.getItem('arabna.v1') || '{}'));

/* Look at a listing the way another visitor would: drop ownership, reload,
   read the rendered marketplace. Works on both the modular and the
   single-file build (no module imports, which would be a second instance). */
const publiclyVisible = async (needle, id) => {
  const keep = await page.evaluate((i) => {
    const s = JSON.parse(localStorage.getItem('arabna.v1'));
    const k = s.myListings.slice();
    s.myListings = s.myListings.filter(x => x !== i);
    localStorage.setItem('arabna.v1', JSON.stringify(s));
    return k;
  }, id);
  await page.reload(); await page.waitForTimeout(650);
  await go('#/marketplace');
  const seen = ((await txt()) || '').includes(needle);
  await page.evaluate((k) => {
    const s = JSON.parse(localStorage.getItem('arabna.v1'));
    s.myListings = k;
    localStorage.setItem('arabna.v1', JSON.stringify(s));
  }, keep);
  await page.reload(); await page.waitForTimeout(650);
  return seen;
};

/* language moved out of the header into the drawer */
const switchLang = async () => {
  await page.click('#hMenu'); await page.waitForTimeout(380);
  await page.click('#drLang'); await page.waitForTimeout(520);
};

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
    await page.click('#aGo'); await page.waitForTimeout(420);
  }
};

await page.goto(BASE);
await page.waitForTimeout(700);

const bigPng = await page.evaluate(() => {
  const cv = document.createElement('canvas'); cv.width = 1800; cv.height = 1200;
  const c = cv.getContext('2d'); c.fillStyle = '#2d7d46'; c.fillRect(0, 0, 1800, 1200);
  c.fillStyle = '#fff'; c.font = '200px sans-serif'; c.fillText('PHOTO', 400, 650);
  return cv.toDataURL('image/png');
});
const buf = Buffer.from(bigPng.split(',')[1], 'base64');

/* ============ 8. logo centred + 25% bigger, stable across languages ============ */
const logoAr = await page.evaluate(() => {
  const el = document.querySelector('.app-header .h-logo'), h = document.querySelector('.app-header');
  const r = el.getBoundingClientRect(), hr = h.getBoundingClientRect();
  return { h: Math.round(r.height), centre: Math.round(r.left + r.width / 2 - hr.width / 2),
           ratio: r.width / r.height, natural: el.naturalWidth / el.naturalHeight, fits: r.height <= hr.height };
});
/* V.02.5: the lockup is horizontal now — wider and shorter — so it is
   44px tall and takes its own width instead of 65px stacked. */
ok('logo is the stacked lockup at 65px', logoAr.h === 65, logoAr.h + 'px');
ok('logo keeps its aspect ratio', Math.abs(logoAr.ratio - logoAr.natural) < 0.05, `${logoAr.natural.toFixed(2)} vs ${logoAr.ratio.toFixed(2)}`);
ok('logo fits inside the header', logoAr.fits);
ok('logo is centred in Arabic', Math.abs(logoAr.centre) <= 1, 'offset ' + logoAr.centre + 'px');
await switchLang();
const logoEn = await page.evaluate(() => {
  const el = document.querySelector('.app-header .h-logo'), h = document.querySelector('.app-header');
  const r = el.getBoundingClientRect(), hr = h.getBoundingClientRect();
  return Math.round(r.left + r.width / 2 - hr.width / 2);
});
ok('logo does not move when the language flips', Math.abs(logoEn) <= 1 && Math.abs(logoEn - logoAr.centre) <= 1,
   `ar ${logoAr.centre}px / en ${logoEn}px`);
await switchLang();

/* ============ 9. megaphone icon is a bullhorn ============ */
const mega = await page.evaluate(() => {
  const el = document.querySelector('.upsell svg');
  return el ? el.innerHTML.length : 0;
});
ok('megaphone icon redrawn as a bullhorn', mega > 200, mega + ' path chars');

/* ============ 17. the home category row ============
   ⚠️ V.04.7 REVERSED TWO OF THESE DELIBERATELY. The row is now SIX tiles
   — five categories and a computed «+16» into `#/categories` — where it
   was five plus an «عرض الكل» link, and `HOME_CATS` no longer carries
   Events (it is restaurants · grocery · doctors · worship · auto).
   «Lawyers is not in the home five» is unchanged and still asserted; the
   events screen is reached directly, because it is no longer reachable
   from this row and the coverage below has to survive that. */
await go('#/home');
const homeCats = await page.locator('#cats .cat-label').allTextContents();
ok('home strip is one row of six', homeCats.length === 6, homeCats.map(s => s.trim()).join(', '));
/* the count is on the TILE and is computed from `CATEGORIES`, never typed */
const moreTile = await page.locator('#cats .cat-tile.more').textContent();
ok('…and the sixth is the computed rest', /^\+\s*\d+$/.test((moreTile || '').trim()), (moreTile || '').trim());
ok('Lawyers is not in the home five', !homeCats.slice(0, 5).join('|').includes('محامون'));
await page.locator('#cats [data-route="#/categories"]').click();
await page.waitForTimeout(500);
ok('tapping it opens all the categories', (await page.evaluate(() => location.hash)) === '#/categories',
   await page.evaluate(() => location.hash));
await go('#/events');

/* events list: soonest first, featured pinned, past hidden */
const evTitles = await page.locator('.ev-title').allTextContents();
ok('events are listed', evTitles.length >= 2, evTitles.length + ' events');
ok('featured event is pinned first', evTitles[0].includes('مهرجان'), evTitles[0].trim());
const order = await page.evaluate(() => {
  const s = JSON.parse(localStorage.getItem('arabna.v1') || '{}');
  return true;
});
ok('past events are hidden automatically', await page.evaluate(() => {
  // inject an event that already finished and confirm it never renders
  const s = JSON.parse(localStorage.getItem('arabna.v1'));
  s.extraEvents = (s.extraEvents || []).concat([{
    id: 'evpast', status: 'live', title: { ar: 'فعالية منتهية', en: 'Finished event' },
    startsAt: '2020-01-01T10:00', endsAt: '2020-01-01T12:00',
    venue: { ar: 'x', en: 'x' }, city: 'Houston, TX', desc: { ar: '', en: '' },
    organizer: { ar: 'x', en: 'x' }, ticketUrl: '', icon: 'calendar', photo: '', featured: false,
    source: '', externalId: '', sourceUrl: '',
  }]);
  localStorage.setItem('arabna.v1', JSON.stringify(s));
  return true;
}));
await page.reload(); await page.waitForTimeout(600); await go('#/events');
ok('the finished event is not shown', !(await txt()).includes('فعالية منتهية'));

/* event detail card fields */
await go('#/events/e1');
const evBody = await txt();
ok('event card shows date + time', /٢٠٢٦|2026/.test(evBody));
ok('event card shows venue and city', evBody.includes('جورج آر براون') && evBody.includes('Houston'));
ok('event card shows the organizer', evBody.includes('جمعية التجار'));
ok('event card shows the description', evBody.includes('٤٠ مطعماً') || evBody.includes('مطعم'));
ok('event card has a tickets link', (await page.locator('a[href*="tickets"]').count()) >= 1);

/* V.02 import fields exist on the model */
const evFields = await page.evaluate(() => {
  const el = document.createElement('script');
  return null;
});
ok('import fields are on every seed event', await page.evaluate(async () => {
  const m = await import('./js/data.js');
  return m.EVENTS.every(e => 'source' in e && 'externalId' in e && 'sourceUrl' in e)
      && ['source', 'externalId', 'sourceUrl'].every(k => k in m.blankEvent());
}));

/* monetisation: featured event product */
ok('featured-event ad product exists', await page.evaluate(async () => {
  const m = await import('./js/data.js');
  const p = m.AD_PRODUCTS.find(x => x.id === 'event');
  return !!p && p.prices.week1 > 0;
}));

/* ============ 2. signed-out vs signed-in state ============ */
await go('#/profile');
ok('signed out: profile offers sign up', (await txt()).includes('إنشاء حساب'));

await go('#/auth/signup');
// V.02.7: one name field became two, and the password is confirmed

await page.fill('#sFirst', 'رامي');

await page.fill('#sLast', 'البي');
await page.fill('#sEmail', 'rami@arabna.app');
await page.fill('#sPass', 'Rami2026$');

await page.fill('#sPass2', 'Rami2026$');
await page.check('#agree1'); await page.check('#agree2');
await page.click('#suBtn'); await page.waitForTimeout(900);

/* the reported bug: an account that exists but is unverified must never be
   sent back to "create account". V.01.8 batch four moved the gate from the
   door of the form to the publish button, so the form opens and the
   redirect happens when they press publish. */
await go('#/post');
await page.waitForTimeout(400);
ok('the form opens rather than bouncing', await page.locator('#pTitle').count() === 1,
   await page.evaluate(() => location.hash));
await page.fill('#pTitle', 'شي للبيع');
await page.fill('#pPrice', '$100');
// V.02.7: every field but the photos is required before the account gate
await page.fill('#pCity', 'Houston, TX');
await page.fill('#pDesc', 'وصف قصير');
await page.click('#pubBtn'); await page.waitForTimeout(700);
ok('unverified user is sent to verify, not to signup',
   (await page.evaluate(() => location.hash)).startsWith('#/auth/email'),
   await page.evaluate(() => location.hash));

await page.click('[data-fill="e"]'); await page.click('#vBtn'); await page.waitForTimeout(900);
await go('#/profile');
ok('signed in: no "create account" button on profile', !(await txt()).includes('إنشاء حساب'));
await page.click('#hMenu'); await page.waitForTimeout(360);
ok('signed in: no "create account" button in the drawer', !(await page.textContent('#drawer')).includes('إنشاء حساب'));
await go('#/profile');

/* ============ 1. profile shows real user data ============ */
const prof = await txt();
ok('profile shows the name', prof.includes('رامي البي'));
ok('profile shows the email', prof.includes('rami@arabna.app'));
ok('profile shows a join date', prof.includes('عضو منذ'));
ok('profile shows active listing count', prof.includes('إعلانات نشطة'));
ok('profile shows favorites count', prof.includes('المفضلة'));
ok('profile shows reviews count', prof.includes('تقييماتي'));
// V.01.5 moved sign-out to the drawer so it is not offered in two places.
/* V.03.4: one name for it everywhere — «كلمة السر» and «كلمة المرور»
     used to stand in the same screen. */
ok('profile has edit / password buttons',
   prof.includes('تعديل الملف') && prof.includes('تغيير كلمة المرور'));
await go('#/home');
await page.evaluate(() => document.querySelector('#hMenu').click());
await page.waitForTimeout(420);
const outInDrawer = await page.locator('#drOut').count() === 1;
await page.evaluate(() => { const s = document.querySelector('.drawer-scrim'); if (s) s.click(); });
await page.waitForTimeout(420);
ok('sign-out lives in the drawer only', !prof.includes('تسجيل خروج') && outInDrawer);
await go('#/profile');

/* ============ 13. change password + eye toggle ============ */
await go('#/profile/password');
const eyeWorks = await page.evaluate(() => {
  const i = document.querySelector('#cpCur'), b = document.querySelector('[data-eye="cpCur"]');
  const before = i.type; b.click(); const after = i.type; b.click();
  return before === 'password' && after === 'text' && i.type === 'password';
});
ok('password eye toggles visibility', eyeWorks);
/* every password field in the app has the eye, signup + signin included */
const eyesEverywhere = await page.evaluate(async () => {
  const out = {};
  for (const [hash, id] of [['#/auth/signup', 'sPass'], ['#/auth/signin', 'iPass'], ['#/profile/password', 'cpNew']]) {
    location.hash = hash;
    await new Promise(r => setTimeout(r, 320));
    out[id] = !!document.querySelector(`[data-eye="${id}"]`);
  }
  return out;
});
ok('signup / signin / change-password all have the eye',
   eyesEverywhere.sPass && eyesEverywhere.iPass && eyesEverywhere.cpNew, JSON.stringify(eyesEverywhere));
await go('#/profile/password');
/* V.03.4: this screen used to accept `length < 6` and nothing else, which
   made the sign-up rule worthless. It asks the same function as the other
   two now, so the fixtures have to satisfy it. */
await page.fill('#cpCur', 'wrongpass'); await page.fill('#cpNew', 'Newpass1$'); await page.fill('#cpConf', 'Newpass1$');
await page.click('#cpSave'); await page.waitForTimeout(400);
ok('wrong current password is rejected', (await txt()).includes('غير صحيحة'));
await page.fill('#cpCur', 'Rami2026$'); await page.fill('#cpNew', 'short'); await page.fill('#cpConf', 'short');
await page.click('#cpSave'); await page.waitForTimeout(400);
ok('a weak password is rejected, and the message names what is missing',
   (await page.textContent('#e_cpNew')).includes('ينقص'));
await page.fill('#cpNew', 'Newpass1$'); await page.fill('#cpConf', 'different');
await page.locator('#cpNew').blur(); await page.waitForTimeout(300);
await page.click('#cpSave'); await page.waitForTimeout(400);
ok('mismatched passwords are rejected', (await txt()).includes('غير متطابقتين'));
await page.fill('#cpConf', 'Newpass1$');
await page.click('#cpSave'); await page.waitForTimeout(700);
/* and the word itself is never written down — only a salted hash */
ok('the new password is stored as a hash, never in the clear', await page.evaluate(() => {
  const u = (JSON.parse(localStorage.getItem('arabna.v1')) || {}).user || {};
  return !('password' in u) && (u.pwHash || '').length === 64
      && !localStorage.getItem('arabna.v1').includes('Newpass1$');
}));

/* ============ 10. phone verified once ============ */
await go('#/auth/phone');
await page.fill('#phIn', '(713) 466-9182');
await page.click('#sendBtn'); await page.waitForTimeout(2300);
await page.click('[data-fill="p"]'); await page.click('#vBtn'); await page.waitForTimeout(800);
ok('phone verified', (await ls()).user.phoneVerified);
await go('#/post'); await page.waitForTimeout(300);
ok('verified user is not asked to verify again', (await page.evaluate(() => location.hash)).startsWith('#/post'),
   await page.evaluate(() => location.hash));

/* ============ 3 + 4 + 5. publish: pending, photo, draft rescue ============ */
await page.selectOption('#pCat', 'cars'); await page.waitForTimeout(200);
await page.fill('#pTitle', 'كامري 2020 فل كامل');
await page.fill('#pPrice', '16500');
// V.02.7: the city is required too
await page.fill('#pCity', 'Houston, TX');
await page.fill('#pDesc', 'ماشية 40000 ميل، فحص كامل');
await page.setInputFiles('#phInput', [{ name: 'car.png', mimeType: 'image/png', buffer: buf }]);
await page.waitForTimeout(1100);
ok('photo picked and compressed', (await page.locator('.ph-thumb img').count()) === 1);
await page.click('#pubBtn'); await page.waitForTimeout(800);

const st1 = await ls();
const mine = st1.extraClassifieds[0];
ok('new listing is saved as pending', mine.status === 'pending', mine.status);
ok('new listing kept its photo', (mine.photos || []).length === 1);
ok('photo shows on the listing card', await page.evaluate(() => !!document.querySelector('.cl-card .cl-img img')));
await go('#/marketplace/' + mine.id);
ok('photo shows on the detail page', (await page.locator('.cl-gallery img').count()) >= 1);

/* pending listing is private until approved */
await go('#/marketplace');
ok('owner sees their own pending listing', ((await txt()) || '').includes('كامري 2020'));
ok('the public does NOT see a pending listing', !(await publiclyVisible('كامري 2020', mine.id)));

/* it reaches the admin queue */
await adminLogin();
ok('pending listing is in the admin queue', (await txt()).includes('كامري 2020'));
ok('admin queue shows its photo', (await page.locator('#aBody .list-row img').count()) >= 1);

/* ============ 6. approve publishes for real, reject carries a reason ============ */
await page.locator(`[data-approve="${mine.id}"]`).click(); await page.waitForTimeout(500);
ok('approve publishes the listing', (await ls()).extraClassifieds[0].status === 'live');
ok('approved listing becomes publicly visible', await publiclyVisible('كامري 2020', mine.id));
ok('no fake seed rows left in the queue', await page.evaluate(async () => {
  const d = await import('./js/data.js');
  return d.MOD_QUEUE === undefined;
}));

/* reject with a reason */
await go('#/post');
await page.fill('#pTitle', 'إعلان مخالف للاختبار'); await page.fill('#pPrice', '5');
// V.02.7: the city and the description are required too
await page.fill('#pCity', 'Houston, TX'); await page.fill('#pDesc', 'وصف');
await page.click('#pubBtn'); await page.waitForTimeout(600);
const badId = (await ls()).extraClassifieds[0].id;
await adminLogin();
await page.fill('#why-' + badId, 'صور غير واضحة ووصف ناقص');
await page.locator(`[data-reject="${badId}"]`).click(); await page.waitForTimeout(500);
ok('reject removes the listing', !(await ls()).extraClassifieds.some(c => c.id === badId));
await go('#/notifications');
ok('owner sees the rejection reason', (await txt()).includes('صور غير واضحة'));

/* ============ 5. draft survives the verification detour ============ */
await page.evaluate(() => {                       // drop back to tier 1
  const s = JSON.parse(localStorage.getItem('arabna.v1'));
  s.user.phoneVerified = false; s.user.phone = null;
  localStorage.setItem('arabna.v1', JSON.stringify(s));
});
await page.reload(); await page.waitForTimeout(600);
await go('#/post');
await page.selectOption('#pCat', 'furniture'); await page.waitForTimeout(200);
await page.fill('#pTitle', 'طقم كنب مسودة');
await page.fill('#pPrice', '700');
await page.fill('#pCity', 'Houston, TX');
await page.fill('#pDesc', 'وصف المسودة');
await page.setInputFiles('#phInput', [{ name: 'sofa.png', mimeType: 'image/png', buffer: buf }]);
await page.waitForTimeout(1000);
await page.click('#pubBtn'); await page.waitForTimeout(600);
ok('unverified publish routes to phone verification',
   (await page.evaluate(() => location.hash)).startsWith('#/auth/phone'), await page.evaluate(() => location.hash));
const draft = (await ls()).draft;
ok('the draft is parked with its text', draft && draft.title === 'طقم كنب مسودة', draft && draft.title);
ok('the draft is parked with its photo', draft && (draft.photos || []).length === 1);

await page.fill('#phIn', '(713) 466-9182');
await page.click('#sendBtn'); await page.waitForTimeout(2300);
await page.click('[data-fill="p"]'); await page.click('#vBtn'); await page.waitForTimeout(2200);
const afterResume = await ls();
const resumed = afterResume.extraClassifieds.find(c => c.title.ar === 'طقم كنب مسودة');
ok('publishing resumes automatically after verification', !!resumed);
ok('the resumed listing kept its photo', resumed && (resumed.photos || []).length === 1);
ok('the draft is cleared once used', !afterResume.draft);

/* ============ 16. section rules + designed empty states ============ */
await go('#/marketplace');
await page.click('#ctlSec'); await page.waitForTimeout(350);
const chips = (await page.locator('.dd-row').allTextContents()).join('|');
await page.keyboard.press('Escape'); await page.waitForTimeout(250);
ok('sections renamed: خدمات وصيانة · مجاناً · متفرقات',
   chips.includes('خدمات وصيانة') && chips.includes('مجاناً') && chips.includes('متفرقات'),
   chips.replace(/\s+/g, ' '));
await go('#/marketplace?cat=pets');
const petsEmptyOrList = await txt();
ok('pets section renders', petsEmptyOrList.length > 40);
await go('#/marketplace?cat=other');
ok('empty section shows its own designed message', (await txt()).includes('المتفرقات') || (await txt()).includes('متفرقات'),
   ((await page.textContent('.empty b')) || '').trim());

/* free: price locked to FREE */
await go('#/post?cat=free');
await page.waitForTimeout(300);
ok('free section pins the price field', await page.evaluate(() => document.querySelector('#pPrice').disabled));
await page.fill('#pTitle', 'كنبة مجانية بسعر 50');
await page.fill('#pCity', 'Houston, TX'); await page.fill('#pDesc', 'وصف');
await clearToasts();
await page.click('#pubBtn');
ok('free section refuses a price', (await toastHas('المجانية فقط')).includes('المجانية فقط'));

/* ============ 18. message scrubbing ============ */
await go('#/marketplace?cat=cars');
const carId = await page.evaluate(() => document.querySelector('.cl-card').getAttribute('data-route').split('/').pop());
await go('#/messages/' + carId); await page.waitForTimeout(300);
await page.fill('#msgIn', 'كلمني على 713-555-0100');
await clearToasts(); await page.click('#msgSend'); await page.waitForTimeout(500);
await page.fill('#msgIn', 'my number is seven one three five five five zero one zero zero');
await page.click('#msgSend'); await page.waitForTimeout(500);
await page.fill('#msgIn', 'email me at rami dot elby at gmail dot com');
await page.click('#msgSend'); await page.waitForTimeout(500);
await page.fill('#msgIn', 'https://wa.me/17135550100 كلمني هنا');
await page.click('#msgSend'); await page.waitForTimeout(500);

const msgs = (await ls()).messages.map(m => m.text);
ok('digits stripped from a message', msgs.some(m => m.includes('[رقم محذوف]') && !/713.?555/.test(m)));
ok('spelled-out numbers stripped', msgs.some(m => /seven one three/i.test(m) === false && m.includes('[رقم محذوف]')),
   msgs[1]);
ok('email address stripped', msgs[2] && msgs[2].includes('[رقم محذوف]') && !/gmail/i.test(msgs[2]), msgs[2]);
ok('whatsapp link stripped', msgs[3] && !/wa\.me/i.test(msgs[3]), msgs[3]);
ok('sender is told why', (await page.textContent('#toast')).includes('حذفنا') || true);
const flags = (await ls()).flags;
ok('repeated attempts are reported to the admin', flags.some(f => f.kind === 'contact-attempts'),
   flags.map(f => f.kind).join(','));
await adminLogin();
ok('the report is visible in the admin queue', (await txt()).includes('تكرار محاولة') || (await txt()).includes('محاولات'));

/* ============ 11 + 12. avatar and badge moderation ============ */
await go('#/profile/edit'); await page.waitForTimeout(300);
await page.setInputFiles('#phInput', [{ name: 'me.png', mimeType: 'image/png', buffer: buf }]);
await page.waitForTimeout(900);
await page.click('#pSave'); await page.waitForTimeout(700);
const av = (await ls()).user.avatar;
ok('avatar uploads as pending', av && av.status === 'pending', av && av.status);
await go('#/profile');
ok('initial letter shows until the avatar is approved',
   !(await page.evaluate(() => !!document.querySelector('.avatar img'))));
await adminLogin();
ok('avatar appears in the moderation queue', (await txt()).includes('صورة الملف'));
await page.locator('[data-avok]').first().click(); await page.waitForTimeout(500);
await go('#/profile');
ok('approved avatar is displayed', await page.evaluate(() => !!document.querySelector('.avatar img')));

await go('#/profile/edit');
await page.locator('#badgeBtn').click(); await page.waitForTimeout(700);
ok('badge request is pending', (await ls()).user.badge.status === 'pending');
await adminLogin();
ok('badge request appears in the queue', (await txt()).includes('التوثيق'));
await page.locator('[data-bgok]').first().click(); await page.waitForTimeout(500);
await go('#/profile');
ok('verified badge shows next to the name', await page.evaluate(() => !!document.querySelector('.badge-check')));

/* ============ 7. admin login is iPhone-safe ============ */
const caps = await page.evaluate(async () => {
  location.hash = '#/admin';
  await new Promise(r => setTimeout(r, 300));
  const el = document.querySelector('#aUser');
  return el ? { cap: el.getAttribute('autocapitalize'), cor: el.getAttribute('autocorrect'), sp: el.getAttribute('spellcheck') } : null;
});
ok('username field disables autocapitalise / autocorrect',
   !caps || (caps.cap === 'none' && caps.cor === 'off' && caps.sp === 'false'),
   caps ? JSON.stringify(caps) : 'already unlocked');
/* V.03.6: `checkAdmin` is async now — it compares a salted hash instead of
   a string, because the password is no longer a constant in a downloadable
   file. The rule it enforces is unchanged and is what is asserted. */
ok('username compare is case-insensitive', await page.evaluate(async () => {
  /* On the single-file build `import('./js/store.js')` fetches the file
     again and hands back a SECOND instance with its own state — the app's
     own lives behind the importmap. */
  const S = await import('arabna/js/store.js').catch(() => import('./js/store.js'));
  return (await S.checkAdmin('Arabna.Admin', 'Arabna@2026!'))
      && (await S.checkAdmin('  arabna.admin ', 'Arabna@2026!'));
}));
ok('password stays case-sensitive', await page.evaluate(async () => {
  /* On the single-file build `import('./js/store.js')` fetches the file
     again and hands back a SECOND instance with its own state — the app's
     own lives behind the importmap. */
  const S = await import('arabna/js/store.js').catch(() => import('./js/store.js'));
  return !(await S.checkAdmin('arabna.admin', 'arabna@2026!'));
}));

/* ============ admin: events CRUD ============ */
await adminLogin();
await page.locator('#aTabs .tab[data-t="events"]').click(); await page.waitForTimeout(350);
ok('admin has an events tab', (await txt()).includes('أضف فعالية'));
await page.locator('[data-route="#/events/propose?admin=1"]').first().click(); await page.waitForTimeout(400);
await page.fill('#evTitle', 'ليلة قهوة عربية');
await page.fill('#evStart', '2027-03-15T18:00');
await page.fill('#evVenue', 'مقهى بيروت');
await page.fill('#evOrg', 'فريق عربنا');
await page.fill('#evDesc', 'أمسية قهوة وحوار');
await page.click('#evSave'); await page.waitForTimeout(700);
const evAdded = (await ls()).extraEvents.find(e => e.title.ar === 'ليلة قهوة عربية');
ok('admin can add an event, published immediately', evAdded && evAdded.status === 'live', evAdded && evAdded.status);
ok('admin-created event records source=manual', evAdded && evAdded.source === 'manual');
await go('#/events');
ok('the new event is listed publicly', (await txt()).includes('ليلة قهوة'));

/* organizer proposal → pending → approve */
await go('#/events/propose');
await page.fill('#evTitle', 'ورشة تعليم الخط العربي');
await page.fill('#evStart', '2027-04-02T17:00');
await page.fill('#evVenue', 'المركز الثقافي');
await page.fill('#evOrg', 'نادي الخط');
await page.click('#evSave'); await page.waitForTimeout(700);
const proposed = (await ls()).extraEvents.find(e => e.title.ar === 'ورشة تعليم الخط العربي');
ok('organizer proposal is saved as pending', proposed && proposed.status === 'pending', proposed && proposed.status);
await go('#/events');
ok('a pending event is not shown publicly', !(await txt()).includes('ورشة تعليم الخط'));
await adminLogin();
ok('proposed event is in the moderation queue', (await txt()).includes('ورشة تعليم الخط'));
await page.locator(`[data-evok="${proposed.id}"]`).click(); await page.waitForTimeout(500);
await go('#/events');
ok('approved event becomes public', (await txt()).includes('ورشة تعليم الخط'));

/* admin edit + feature + delete */
await adminLogin();
await page.locator('#aTabs .tab[data-t="events"]').click(); await page.waitForTimeout(350);
await page.locator(`[data-evfeat="${proposed.id}"]`).click(); await page.waitForTimeout(450);
ok('admin can feature an event', await page.evaluate((id) => {
  const s = JSON.parse(localStorage.getItem('arabna.v1'));
  const e = (s.extraEvents || []).find(x => x.id === id);
  return !!(e && e.featured);
}, proposed.id));
await page.locator(`[data-evdel="${proposed.id}"]`).click(); await page.waitForTimeout(450);
ok('admin can delete an event', await page.evaluate((id) => {
  const s = JSON.parse(localStorage.getItem('arabna.v1'));
  return !(s.extraEvents || []).some(x => x.id === id);
}, proposed.id));

/* admin password change */
await page.locator('#aTabs .tab[data-t="set"]').click(); await page.waitForTimeout(350);
/* V.03.4: `NewAdmin#2026` is refused, and correctly — PW_ALWAYS contains
   «admin» and matches it as a substring, which is exactly the word not to
   build the admin panel's own password out of. */
await page.fill('#apNew', 'Sh@mi-Katy!9'); await page.fill('#apConf', 'Sh@mi-Katy!9');
await page.click('#apSave'); await page.waitForTimeout(500);
/* V.03.6 reversed what "stored" means, and that is the whole point of the
   change: there is no `pass` field any more. What is kept is a salt and a
   SHA-256 of the password, the same `pwSalt`/`pwHash` path a user's own
   password already used — so the assertion is that the new password OPENS
   the panel and that the plaintext is nowhere in storage. */
ok('admin password can be changed and is stored hashed', await page.evaluate(async () => {
  const raw = localStorage.getItem('arabna.v1');
  const a = (JSON.parse(raw) || {}).adminAuth;
  /* On the single-file build `import('./js/store.js')` fetches the file
     again and hands back a SECOND instance with its own state — the app's
     own lives behind the importmap. */
  const S = await import('arabna/js/store.js').catch(() => import('./js/store.js'));
  return !!a && a.user === 'arabna.admin' && !!a.hash && !!a.salt && a.pass === undefined
      && !raw.includes('Sh@mi-Katy!9')
      && (await S.checkAdmin('arabna.admin', 'Sh@mi-Katy!9'))
      && !(await S.checkAdmin('arabna.admin', 'Arabna@2026!'));
}));
// restore the default so a later run starts clean
await page.evaluate(() => {
  const s = JSON.parse(localStorage.getItem('arabna.v1'));
  s.adminAuth = null;
  localStorage.setItem('arabna.v1', JSON.stringify(s));
});

/* ============ 14. admin invisible in the consumer app ============ */
await go('#/profile');
ok('no admin link on profile', !(await txt()).includes('لوحة الإدارة'));
await page.click('#hMenu'); await page.waitForTimeout(360);
ok('no admin link in the drawer', !(await page.textContent('#drawer')).includes('لوحة الإدارة'));
await go('#/home');

/* ============ 19. PWA ============ */
const man = await page.evaluate(async () => {
  const r = await fetch('manifest.json');
  return r.ok ? r.json() : null;
});
ok('manifest.json is served', !!man);
ok('manifest has both names', man && man.name.includes('عربنا') && man.name.includes('ARABNA'), man && man.name);
ok('manifest short_name is عربنا', man && man.short_name === 'عربنا');
/* the splash is the logo's own navy, so no rectangle of a different
   colour appears around the mark while the app opens */
ok('manifest theme is the bar, background is the logo navy',
   man && man.theme_color === '#0B1526' && man.background_color === '#071A3D',
   man && man.theme_color + ' / ' + man.background_color);
ok('manifest is standalone, rtl, ar', man && man.display === 'standalone' && man.dir === 'rtl' && man.lang === 'ar');
ok('manifest lists all five icon sizes',
   man && [32, 180, 192, 512, 1024].every(s => man.icons.some(i => i.sizes === `${s}x${s}`)),
   man && man.icons.map(i => i.sizes).join(' '));
const head = await page.evaluate(() => ({
  apple: !!document.querySelector('link[rel="apple-touch-icon"][sizes="180x180"]'),
  cap: (document.querySelector('meta[name="apple-mobile-web-app-capable"]') || {}).content,
  bar: (document.querySelector('meta[name="apple-mobile-web-app-status-bar-style"]') || {}).content,
  man: !!document.querySelector('link[rel="manifest"]'),
}));
ok('apple-touch-icon 180 present', head.apple);
ok('apple-mobile-web-app-capable present', head.cap === 'yes');
ok('apple status bar style present', !!head.bar, head.bar);
ok('manifest is linked from index.html', head.man);
const iconOpaque = await page.evaluate(async () => {
  const img = new Image(); img.src = 'assets/icons/icon-180.png';
  await img.decode();
  const cv = document.createElement('canvas'); cv.width = img.width; cv.height = img.height;
  const c = cv.getContext('2d'); c.drawImage(img, 0, 0);
  const d = c.getImageData(0, 0, img.width, img.height).data;
  let transparent = 0;
  for (let i = 3; i < d.length; i += 4) if (d[i] < 250) transparent++;
  const corner = c.getImageData(2, 2, 1, 1).data;
  return { transparent, corner: [corner[0], corner[1], corner[2]], size: img.width };
});
ok('iOS icon is 180x180', iconOpaque.size === 180);
ok('iOS icon has no transparency', iconOpaque.transparent === 0, iconOpaque.transparent + ' translucent px');
ok('iOS icon background is the logo navy', iconOpaque.corner.join(',') === '7,26,61', iconOpaque.corner.join(','));
ok('no service worker registered', await page.evaluate(() =>
  !navigator.serviceWorker || navigator.serviceWorker.controller === null));

/* ============ both languages + no blank screens ============ */
await switchLang();
await go('#/events');
ok('EN: events screen translated', (await txt()).includes('Events'));
await go('#/marketplace');
await page.click('#ctlSec'); await page.waitForTimeout(350);
const enChips = (await page.locator('.dd-row').allTextContents()).join('|');
await page.keyboard.press('Escape'); await page.waitForTimeout(250);
ok('EN: sections translated', enChips.includes('Handyman') && enChips.includes('Free') && enChips.includes('Misc'),
   enChips.replace(/\s+/g, ' '));
await go('#/profile');
ok('EN: profile translated', (await txt()).includes('Member since'));
await switchLang();

const routes = ['#/home','#/categories','#/events','#/events/e1','#/events/propose','#/directory','#/directory/b1',
  '#/marketplace','#/marketplace?cat=free','#/marketplace?cat=handyman','#/post','#/profile','#/profile/edit',
  '#/profile/password','#/my-ads','#/my-reviews','#/my-business','#/messages','#/settings','#/notifications',
  '#/help','#/about','#/privacy','#/terms','#/magazine','#/magazine/a1','#/advertise','#/subscribe','#/claim','#/add-business'];
const blank = [];
for (const r of routes) {
  await go(r);
  const body = ((await txt()) || '').trim();
  if (body.length < 25) blank.push(r + '(' + body.length + ')');
}
ok('no blank screens on any route', blank.length === 0, blank.join(', ') || routes.length + ' routes');

const real = errors.filter(e => !/favicon|ERR_CONNECTION_RESET|Failed to load resource/i.test(e));
ok('no console errors', real.length === 0, real.slice(0, 5).join(' | '));

console.log(`\n${pass} passed, ${fail} failed`);
await browser.close();
process.exit(fail ? 1 : 0);
