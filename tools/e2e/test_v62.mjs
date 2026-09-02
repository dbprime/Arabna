/* V.08.7 — the advertiser sees the ad as people will see it, before paying.

   ⚠️ THE OWNER'S REQUEST: «when he picks, show him a preview of where the ad
   goes». Measured under it, the paid slide broke its own promise twice:
     the buyer's PHOTO was collected, stored on the order, and never drawn —
       the slide rendered a megaphone over it, while the page promised
       «صورة وعنوان ووصف وزر إجراء»;
     the slide LED BACK TO HOME — no destination field in step 3, no bizId
       on the order — so the dearest product in the app, when tapped,
       returned the reader to the screen they were on.

   THE RULE: the preview is never built to show anything other than what
   will be shown — one function draws the paid slide, and Home and the
   preview both read it. What the slide cannot do, the preview does not
   promise. Item 3.1 compares the two markups letter by letter. */
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import { readFileSync } from 'node:fs';

const BASE = process.env.BASE || 'http://localhost:8099/index.html';
const ROOT = new URL('../../', import.meta.url).pathname;
let pass = 0, fail = 0;
const ok = (n, c, extra = '') => { if (c) { pass++; console.log('PASS ' + n + (extra ? ' -> ' + extra : '')); }
  else { fail++; console.log('FAIL ' + n + (extra ? ' -> ' + extra : '')); } };

const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';
const ACCOUNT = { email: 'a@b.c', emailVerified: true, phone: '(713) 466-9182', phoneVerified: true, tier: 2, name: 'x', joined: 1 };
const order = (over) => Object.assign({ id: 'o' + Math.random().toString(36).slice(2, 7), product: 'slider', status: 'live',
  endsAt: Date.now() + 9e8, bizName: 'مطعم الاختبار', tagline: 'وصف', ctaText: 'اطلب' }, over);

const browser = await chromium.launch();
async function open(route, extra = {}) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  await ctx.addInitScript((extra) => {
    const K = 'arabna.v1'; let s = {}; try { s = JSON.parse(localStorage.getItem(K) || '{}'); } catch (e) { /* */ }
    Object.assign(s, { lang: 'ar', showDemo: false, demoDefaultOff: true }, extra);
    localStorage.setItem(K, JSON.stringify(s));
  }, extra);
  const page = await ctx.newPage();
  await page.route('**://fonts.g*/**', r => r.abort());
  await page.goto(BASE + route, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(700);
  return { page, ctx };
}
/* the app's own modules — on the single-file build the relative path is a
   second instance with its own state */

/* ============ 1 — the photo is drawn ============ */
{
  const withPhoto = order({ image: PNG, link: '#/directory/b30', bizId: 'b30' });
  const noPhoto = order({ link: '#/directory/b31', bizId: 'b31' });
  const { page, ctx } = await open('#/home', { user: ACCOUNT, myAds: [withPhoto, noPhoto] });
  const r = await page.evaluate((ids) => {
    const find = (route) => document.querySelector(`.slide[data-route="${route}"]`);
    const a = find('#/directory/b30'), b = find('#/directory/b31');
    return {
      aImg: a && a.querySelector('img.slide-photo') ? a.querySelector('img.slide-photo').getAttribute('src') : null,
      aIcon: a ? a.querySelectorAll('.slide-icon').length : -1,
      bImg: b ? b.querySelectorAll('img').length : -1, bIcon: b ? b.querySelectorAll('.slide-icon').length : -1,
      /* offsetWidth, not the client rect: an inactive slide carries a
         transform, and the rect would measure the animation, not the box */
      aW: a ? a.offsetWidth : -1, bW: b ? b.offsetWidth : -1,
      aTitleH: a ? a.querySelector('.slide-title').offsetHeight : -1,
      bTitleH: b ? b.querySelector('.slide-title').offsetHeight : -1,
      aRoute: a && a.dataset.route,
    };
  });
  ok('1.1 an order with a photo draws <img class="slide-photo"> and no .slide-icon', !!r.aImg && r.aIcon === 0, `icon ${r.aIcon}`);
  ok('1.2 an order without a photo draws .slide-icon and no <img>', r.bImg === 0 && r.bIcon === 1);
  ok('1.3 the src is the order\'s image, letter for letter', r.aImg === PNG);
  /* ============ 2 — the destination ============ */
  ok('2.1 an order aimed at a business routes to #/directory/<bizId>', r.aRoute === '#/directory/b30', String(r.aRoute));
  /* ⚠️ the photo takes the icon's exact place: same width, and the title
     wraps no more than it did */
  ok('2.3 a slide with a photo and one without are the same width, and the title wraps no more',
     r.aW === r.bW && r.aW > 0 && r.aTitleH === r.bTitleH, `${r.aW}/${r.bW} · title ${r.aTitleH}/${r.bTitleH}`);
  await ctx.close();
}
{
  const tel = order({ link: 'tel:+13463533322', phone: '+13463533322' });
  const { page, ctx } = await open('#/home', { user: ACCOUNT, myAds: [tel] });
  const before = await page.evaluate(() => location.hash);
  const route = await page.evaluate(() => { const s = document.querySelector('.slide[data-route^="tel:"]'); return s ? s.dataset.route : null; });
  await page.evaluate(() => { const s = document.querySelector('.slide[data-route^="tel:"]'); if (s) s.click(); });
  await page.waitForTimeout(300);
  const after = await page.evaluate(() => location.hash);
  ok('2.2 an order aimed at a phone routes to tel:, and a tap does not move the hash', route === 'tel:+13463533322' && before === after, `${route} · ${before} → ${after}`);
  await ctx.close();
}

/* ============ 3 — the preview IS the slide ============ */
/* the slider is not the cheapest package, so its card is folded on arrival
   and its start button is `visibility: hidden` — open the card first */
async function startSlider(page) {
  await page.click('.price-card[data-p="slider"]'); await page.waitForTimeout(450);
  await page.click('[data-start="slider"]'); await page.waitForTimeout(400);
}
async function driveToStep4(page, dest = 'auto', phone = '') {
  await startSlider(page);
  await page.click('#next2'); await page.waitForTimeout(400);
  await page.fill('#aName', 'مطعم المعاينة'); await page.fill('#aTag', 'أفضل شاورما'); await page.fill('#aCta', 'اطلب الآن');
  if (dest !== 'auto') { await page.selectOption('#aDest', dest); await page.waitForTimeout(100); }
  if (phone) await page.fill('#aPhone', phone);
  await page.click('#next3'); await page.waitForTimeout(500);
}
{
  const { page, ctx } = await open('#/advertise', { user: ACCOUNT, myBusinessIds: ['b30'] });
  await driveToStep4(page);
  /* ⚠️ no eval — `script-src 'self'` refuses it; a dynamic import of the
     app's own module is what CSP allows, and `arabna/…` is the importmap
     name that reaches the SAME instance on the single-file build */
  const r = await page.evaluate(async () => {
    let U, S;
    try { U = await import('arabna/js/ui.js'); S = await import('arabna/js/store.js'); }
    catch (e) { U = await import('./js/ui.js'); S = await import('./js/store.js'); }
    const pv = document.querySelector('.ad-live-preview .slide');
    const card = document.querySelector('.ad-live-preview').nextElementSibling.nextElementSibling; // hint, then section title… find the review card below
    const review = [...document.querySelectorAll('.card')].find(c => c.getBoundingClientRect().top > pv.getBoundingClientRect().top);
    /* the same content placed as an order, made live, read back through
       orderAsSlide → the slide Home would draw */
    const rec = S.addAdOrder({ product: 'slider', duration: 'week1', price: 0, bizName: 'مطعم المعاينة', tagline: 'أفضل شاورما',
      ctaText: 'اطلب الآن', image: '', link: '#/directory/b30', bizId: 'b30', phone: '' });
    S.approveAd(rec.id);
    const slide = S.sliderAds().find(a => a.orderId === rec.id);
    /* ⚠️ BOTH SIDES THROUGH THE DOM. The preview is read back as outerHTML,
       which re-serialises `<polyline …/>` as `<polyline …></polyline>`; a
       source string compared against it would differ on serialisation and
       not on content. Parsing the expected markup the same way makes the
       comparison letter-for-letter on what the browser renders. */
    const tpl = document.createElement('template');
    tpl.innerHTML = U.adSlideHtml(slide, true, { share: false }).trim();
    const norm = (h) => h.replace(/\s+/g, ' ').trim();
    const homeHtml = norm(tpl.content.firstElementChild.outerHTML);
    const A = norm(pv.outerHTML), B = homeHtml;
    let k = 0; while (k < A.length && k < B.length && A[k] === B[k]) k++;
    return { same: A === B, pvTop: pv.getBoundingClientRect().top, reviewTop: review ? review.getBoundingClientRect().top : -1,
      buttons: pv.querySelectorAll('button').length, hash: location.hash, pe: getComputedStyle(pv.closest('.ad-live-preview')).pointerEvents,
      a: 'preview@' + k + ': …' + A.slice(Math.max(0, k - 20), k + 60), b: 'home: …' + B.slice(Math.max(0, k - 20), k + 60) };
  });
  ok('3.1 the preview markup equals adSlideHtml(orderAsSlide(the same content)) letter for letter', r.same, r.same ? '' : r.a + ' ≠ ' + r.b);
  ok('3.2 the preview stands above the review card', r.pvTop >= 0 && r.reviewTop > r.pvTop, `${Math.round(r.pvTop)} < ${Math.round(r.reviewTop)}`);
  const box = await page.evaluate(() => { const r = document.querySelector('.ad-live-preview .slide').getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; });
  await page.mouse.click(box.x, box.y); await page.waitForTimeout(300);
  const hashAfter = await page.evaluate(() => location.hash);
  ok('3.3 tapping the preview changes nothing', hashAfter === r.hash && r.pe === 'none', `${r.hash} → ${hashAfter} · pointer-events ${r.pe}`);
  ok('3.4 the preview carries no share button', r.buttons === 0, r.buttons + ' button(s)');
  await ctx.close();
}

/* ============ 4 — the destination field ============ */
const packs = readFileSync(ROOT + 'js/i18n.js', 'utf8');
const key = (k) => [...packs.matchAll(new RegExp(k + ":\\s*'([^']+)'", 'g'))].map(m => m[1]);
{
  const { page, ctx } = await open('#/advertise', { user: ACCOUNT, myBusinessIds: [] });
  await driveToStep4(page, 'auto', '');
  const r = await page.evaluate(() => ({ still3: !!document.querySelector('#next3'), toast: (document.querySelector('#toast') || {}).innerText || '' }));
  ok('4.1 next3 with no destination does not advance, and says why', r.still3 && key('adDestinationRequired').some(t => r.toast.includes(t)), r.toast.trim().slice(0, 60));
  await ctx.close();
}
{
  const { page, ctx } = await open('#/advertise', { user: ACCOUNT, myBusinessIds: ['b30'] });
  await startSlider(page); await page.click('#next2'); await page.waitForTimeout(300);
  const r = await page.evaluate(() => { const s = document.querySelector('#aDest'); return { v: s.value, txt: s.options[s.selectedIndex] && s.options[s.selectedIndex].textContent.trim() }; });
  ok('4.2 one business: preselected, and its name shows', r.v === 'biz:b30' && r.txt && !/^biz:/.test(r.txt), `${r.v} · ${r.txt}`);
  await ctx.close();
}
{
  const { page, ctx } = await open('#/advertise', { user: ACCOUNT, myBusinessIds: ['b30', 'b31'] });
  await startSlider(page); await page.click('#next2'); await page.waitForTimeout(300);
  const r = await page.evaluate(() => { const s = document.querySelector('#aDest'); return { v: s.value, biz: [...s.options].filter(o => o.value.startsWith('biz:')).length }; });
  ok('4.3 two businesses: both listed, none preselected', r.biz === 2 && r.v === '', `${r.biz} · '${r.v}'`);
  await ctx.close();
}
{
  const { page, ctx } = await open('#/advertise', { user: ACCOUNT, myBusinessIds: [] });
  await startSlider(page); await page.click('#next2'); await page.waitForTimeout(300);
  await page.selectOption('#aDest', 'phone'); await page.waitForTimeout(100);
  const r = await page.evaluate(() => { const s = document.querySelector('#aDest'); return { biz: [...s.options].filter(o => o.value.startsWith('biz:')).length, phoneShown: !document.querySelector('#aPhone').hidden }; });
  ok('4.4 no business: the phone field is the only door', r.biz === 0 && r.phoneShown, `biz ${r.biz} · phone ${r.phoneShown}`);
  await ctx.close();
}

/* ============ 5 — the old orders, the keys, the one copy ============ */
{
  const old = order({}); delete old.image; delete old.link;
  const { page, ctx } = await open('#/home', { user: ACCOUNT, myAds: [old] });
  const r = await page.evaluate(() => { const s = document.querySelector('.slide[data-route="#/home"]'); return s ? { icon: s.querySelectorAll('.slide-icon').length, img: s.querySelectorAll('img').length } : null; });
  ok('5.1 an old order with no image and no link draws as before — megaphone and #/home', !!r && r.icon === 1 && r.img === 0, JSON.stringify(r));
  const body = await page.evaluate(() => document.body.innerText);
  const keys = ['adDestination', 'adDestBusiness', 'adDestPhone', 'adDestinationRequired', 'adPreviewTitle', 'adPreviewSub', 'adPreviewNote'];
  ok('5.2 the seven keys are in both packs, and none is printed by name', keys.every(k => key(k).length === 2) && !keys.some(k => body.includes(k)));
  await ctx.close();
}
/* ⚠️ ACROSS ALL OF js/, not ui.js alone: Home and the directory each had
   their own hand-written copy too — the directory's without even a
   data-route. One `slide-badge` in the whole tree means one slide. */
{
  const { readdirSync } = await import('node:fs');
  const walk = (d) => readdirSync(d, { withFileTypes: true }).flatMap(e => e.isDirectory() ? walk(d + e.name + '/') : e.name.endsWith('.js') ? [d + e.name] : []);
  const hits = walk(ROOT + 'js/').filter(f => /slide-badge/.test(readFileSync(f, 'utf8'))).map(f => f.slice(ROOT.length));
  ok('5.3 no hand-written paid slide is left anywhere in js/ — one slide-badge, in ui.js', hits.length === 1 && hits[0] === 'js/ui.js', hits.join(', '));
}

await browser.close();
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
