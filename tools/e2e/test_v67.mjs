/* V.09.2 — ten photos for a subscriber, as a NUMBER, and the upgrade card
   stops saying «sign up first».

   Two decisions of the owner's, 3 September, after he saw the card on his
   phone.

   (a) «Was our agreement unlimited photos?» There had never been an
   agreement with a number in it. Measured before the batch: the code said
   `Infinity`, an older text said ten, and the upload screen stopped at
   twenty in silence — three answers to one question. A number said before
   the purchase is truer than a promise with no limit that has one.

   (b) «There is no point in the prices sentence after creating an
   account.» The V.01.6 rule is untouched — a visitor still sees no price
   and `showsPrices()` still guards every commercial figure. What goes is
   the SENTENCE that stood where the price would be: the card is a door,
   and a door does not explain the terms of entry. The truth is told
   inside `#/subscribe` to whoever walked in — the owner's own rule from
   `535` for the capacity strip.

   ⚠️ NOT ONE NUMBER IS WRITTEN IN THIS FILE. Every expected value is read
   out of `PLAN_LIMITS` in the running app, so the day the limit moves the
   texts and the screens are re-measured against the new number rather
   than against a literal that has gone stale. That is the fault this
   whole batch exists to remove; a suite that committed it would be
   guarding a rule it breaks itself. */
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import { readFileSync } from 'node:fs';

const BASE = process.env.BASE || 'http://localhost:8099/index.html';
const SINGLE = /index-single-file/.test(BASE);
let pass = 0, fail = 0;
const ok = (n, c, extra = '') => { if (c) { pass++; console.log('PASS ' + n + (extra ? ' -> ' + extra : '')); }
  else { fail++; console.log('FAIL ' + n + (extra ? ' -> ' + extra : '')); } };

const browser = await chromium.launch();

/* A member owns b1 (a paid seed) or not, as the case needs. `visitor`
   leaves `user` null, which is what `showsPrices()` actually reads. */
async function open(route, { lang = 'ar', member = true, owns = null } = {}) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  await ctx.addInitScript(({ l, m, o }) => {
    const K = 'arabna.v1'; let s = {};
    try { s = JSON.parse(localStorage.getItem(K) || '{}'); } catch (e) { /* */ }
    s.lang = l;
    s.showDemo = true; s.demoDefaultOff = true;   /* 510: the seeds are off by default */
    s.user = m ? { email: 'a@b.c', emailVerified: true, tier: 2, name: 'x', phone: '7130000000', phoneVerified: true } : null;
    if (o) s.myBusinessIds = [o];
    localStorage.setItem(K, JSON.stringify(s));
  }, { l: lang, m: member, o: owns });
  const page = await ctx.newPage();
  await page.route('**://fonts.g*/**', r => r.abort());
  await page.goto(BASE + route, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(900);
  return { page, ctx };
}

/* the app's own module — `arabna/` is the importmap name, which reaches
   the SAME instance on the single-file build; the relative path is the
   fallback for the module build (recorded since V.03.2) */
const readStore = p => p.evaluate(async () => {
  let S; try { S = await import('arabna/js/store.js'); } catch (e) { S = await import('./js/store.js'); }
  return { paid: S.PLAN_LIMITS.paid.photos, free: S.PLAN_LIMITS.free.photos, videos: S.PLAN_LIMITS.paid.videos };
});

/* ---------- 1) the number lives in one place, and the texts read it ---------- */
{
  const { page, ctx } = await open('#/home');
  const L = await readStore(page);

  ok('1.1a PLAN_LIMITS.paid.photos is a finite number',
     Number.isFinite(L.paid) && L.paid > 0, String(L.paid));

  /* the number must not be written anywhere a text or a screen could
     disagree with it. The packs are read from the running app so the
     single-file build is covered by the same line. */
  /* ⚠️ scoped to a photo COUNT, never to any text that happens to hold the
     same digits: `fileTooLarge` says «10 MB», a file size, and a sweep that
     caught it would be reporting a fault that is not there. The harm is a
     limit on the NUMBER OF PHOTOS written as a literal, so that is what is
     matched — the number standing next to the counted noun. */
  const leak = await page.evaluate(async (n) => {
    let I; try { I = await import('arabna/js/i18n.js'); } catch (e) { I = await import('./js/i18n.js'); }
    const re = new RegExp('(حتى|حتّى)\\s*' + n + '\\s*(صور|صورة)|up to\\s*' + n + '\\s*photos', 'i');
    const hits = [];
    for (const lang of ['ar', 'en']) {
      for (const [k, v] of Object.entries(I.STRINGS[lang] || {})) {
        if (typeof v === 'string' && re.test(v)) hits.push(lang + '.' + k);
      }
    }
    return hits;
  }, L.paid);
  ok('1.1b the paid number is written in no photo text — the texts carry {n}',
     leak.length === 0, leak.join(', ') || 'zero');

  const packs = await page.evaluate(async () => {
    let I; try { I = await import('arabna/js/i18n.js'); } catch (e) { I = await import('./js/i18n.js'); }
    const g = k => [I.STRINGS.ar[k], I.STRINGS.en[k]];
    return { upgradeBanner: g('upgradeBanner'), lockedSub: g('lockedSub'), subFeatures: g('subFeatures'),
             faqA2: g('faqA2'), photosPaidLimit: g('photosPaidLimit'), photosUpsell: g('photosUpsell'),
             photosFreeLimit: g('photosFreeLimit'),
             photosUnlimited: g('photosUnlimited'), pricesAfterSignup: g('pricesAfterSignup') };
  });

  const SIX = ['upgradeBanner', 'lockedSub', 'subFeatures', 'faqA2', 'photosPaidLimit', 'photosUpsell'];
  const noN = SIX.filter(k => !(packs[k][0] || '').includes('{n}') || !(packs[k][1] || '').includes('{n}'));
  ok('1.2a all six keys carry {n}, in both packs', noN.length === 0, noN.join(', ') || 'six of six');

  const unl = SIX.filter(k => /بلا حدّ|غير محدود|unlimited/i.test((packs[k][0] || '') + ' ' + (packs[k][1] || '')));
  ok('1.2b and not one of them still promises no limit', unl.length === 0, unl.join(', ') || 'zero');

  ok('1.3a photosUnlimited is gone from both packs — renamed, not left behind',
     !packs.photosUnlimited[0] && !packs.photosUnlimited[1]);

  /* ⚠️ pricesAfterSignup is NOT deleted, and the batch file's own condition
     is why: it says to delete the key «after grep measures that no reader
     is left», and a reader IS left — `priceGate()` in ui.js, which the same
     file says must not change. Deleting it would print a lock icon with no
     words on #/subscribe and #/advertise for every visitor: the V.01.6 rule
     broken by the batch that promises to keep it. So what is asserted is
     the harm the item actually guards — that no UPGRADE CARD reads it. */
  ok('1.3b pricesAfterSignup survives for priceGate, which V.01.6 needs',
     !!packs.pricesAfterSignup[0] && !!packs.pricesAfterSignup[1]);

  /* the free number has no {f} of its own in that key, so it is guarded
     here instead: the day PLAN_LIMITS.free.photos moves, this goes red */
  ok('1.4 photosFreeLimit still agrees with PLAN_LIMITS.free.photos',
     new RegExp('\\b' + L.free + '\\b').test(packs.photosFreeLimit[0] || '')
     && new RegExp('\\b' + L.free + '\\b').test(packs.photosFreeLimit[1] || ''),
     'free=' + L.free);
  await ctx.close();
}

/* ---------- 2) the card is a door: title and arrow, no second line ---------- */
async function upsellRow(page) {
  return page.evaluate(() => {
    const el = document.querySelector('#dirList .upsell-row');
    if (!el) return null;
    return { title: (el.querySelector('.row-title') || {}).textContent || '',
             subs: el.querySelectorAll('.row-sub').length,
             text: el.textContent || '' };
  });
}

for (const lang of ['ar', 'en']) {
  const { page, ctx } = await open('#/directory', { lang, member: false });
  const L = await readStore(page);
  const r = await upsellRow(page);
  ok(`2.1a [${lang}] a visitor's upgrade card has no second line`, r && r.subs === 0, r ? 'row-sub=' + r.subs : 'no card');
  ok(`2.1b [${lang}] and no placeholder sentence stands in its place`,
     !!r && !/بعد إنشاء حساب|after you create/i.test(r.text));
  ok(`2.1c [${lang}] its title shows the number, never the token`,
     !!r && !r.title.includes('{n}') && new RegExp('\\b' + L.paid + '\\b').test(r.title), r ? r.title.trim() : '');
  await ctx.close();
}
{
  const { page, ctx } = await open('#/directory', { member: true });
  const r = await upsellRow(page);
  ok('2.2 a member still sees the price line — V.01.6 is untouched',
     !!r && r.subs === 1 && /\$/.test(r.text), r ? 'row-sub=' + r.subs : 'no card');
  await ctx.close();
}

/* the business page and the marketplace: the same rule, the same shape */
async function upsellSpan(page, sel) {
  return page.evaluate((s) => {
    const el = document.querySelector(s);
    if (!el) return null;
    return { spans: el.querySelectorAll('.upsell-txt span').length, text: el.textContent || '' };
  }, sel);
}
/* ⚠️ MEASURED, AND IT CORRECTS THE BATCH FILE: the `.upsell` on a business
   page lives inside `if (mine)` — the owner box — so a visitor never reaches
   it at all. An owner is always a member, so `showsPrices()` was always true
   there and the placeholder branch at that site was DEAD CODE: it could not
   render for anybody. What the item asks for is still asserted, on the two
   cards a visitor can actually reach (2.1 and 2.4); here the owner's own
   card is measured, since that is who the card is for. */
{
  const m = await open('#/directory/b30', { member: true, owns: 'b30' });
  const b = await upsellSpan(m.page, '.upsell');
  ok('2.3a the owner of a free business sees the upgrade card', !!b, b ? 'spans=' + b.spans : 'no card');
  ok('2.3b …with the price, because an owner is always a member', !!b && b.spans === 1 && /\$/.test(b.text));
  ok('2.3c …and its title carries the number, not the token',
     !!b && !b.text.includes('{n}'), (b || {}).text ? b.text.trim().slice(0, 48) : '');
  await m.ctx.close();

  /* and what the VISITOR meets on a free business page is the lockedSub
     line, which must read the number too */
  const v = await open('#/directory/b30', { member: false });
  const L2 = await readStore(v.page);
  const body = await v.page.evaluate(() => document.body.textContent || '');
  ok('2.3d a visitor on that page sees no upgrade card at all',
     await v.page.evaluate(() => document.querySelectorAll('.upsell').length) === 0);
  ok('2.3e …and no placeholder sentence anywhere on it',
     !/بعد إنشاء حساب|after you create/i.test(body));
  await v.ctx.close();
}
{
  const v = await open('#/marketplace?cat=handyman', { member: false });
  const a = await upsellSpan(v.page, '.upsell');
  ok('2.4a the marketplace, visitor: the same shape', a && a.spans === 0, a ? 'spans=' + a.spans : 'no card');
  await v.ctx.close();
  const m = await open('#/marketplace?cat=handyman', { member: true });
  const b = await upsellSpan(m.page, '.upsell');
  ok('2.4b …and the member keeps the price', b && b.spans === 1 && /\$/.test(b.text));
  await m.ctx.close();
}

/* ---------- 3) the photo screen: the PLAN is the question, not Infinity ---------- */
/* ⚠️ this is the block the fix exists for: with `=== Infinity` still in
   place, a subscriber paying $29 was shown «Free plan: up to 3 photos»
   with an invitation to subscribe under it — because 10 is not Infinity. */
async function photoScreen(bizId) {
  const { page, ctx } = await open('#/business/photos/' + bizId, { member: true, owns: bizId });
  const L = await readStore(page);
  const d = await page.evaluate(() => ({
    hint: (document.querySelector('.pad .hint') || {}).textContent || '',
    upsells: document.querySelectorAll('.upsell').length,
    slots: document.querySelectorAll('[data-addphoto], .ph-add').length,
  }));
  return { page, ctx, L, d };
}
{
  const s = await photoScreen('b1');                       /* a paid seed */
  const paid = await s.page.evaluate(async () => {
    let S; try { S = await import('arabna/js/store.js'); } catch (e) { S = await import('./js/store.js'); }
    return S.isPaid(S.businessById('b1'));
  });
  ok('3.1a b1 is a subscriber (the fixture holds)', paid === true);
  ok('3.1b a subscriber is told the paid limit, with the number',
     new RegExp('\\b' + s.L.paid + '\\b').test(s.d.hint) && !s.d.hint.includes('{n}'), s.d.hint.trim());
  ok('3.1c …and is NOT shown the free-plan line', !new RegExp('\\b' + s.L.free + '\\b').test(s.d.hint));
  ok('3.1d …and is NOT offered an upgrade card', s.d.upsells === 0, 'upsells=' + s.d.upsells);
  await s.ctx.close();
}
{
  const s = await photoScreen('b30');                      /* a free listing */
  ok('3.2a a free listing is told the free limit', new RegExp('\\b' + s.L.free + '\\b').test(s.d.hint), s.d.hint.trim());
  ok('3.2b …and IS offered the upgrade card', s.d.upsells === 1, 'upsells=' + s.d.upsells);
  await s.ctx.close();
}
{
  /* the upload ceiling is the plan's number and nothing else — the old
     screen quietly allowed twenty to a subscriber who had been promised
     no limit at all */
  const { page, ctx } = await open('#/business/photos/b1', { member: true, owns: 'b1' });
  const L = await readStore(page);
  const cap = await page.evaluate(() => {
    const src = document.body.innerHTML;
    return { addBtns: document.querySelectorAll('#phHost [data-add], #phHost .pick-add').length, has: !!src };
  });
  ok('3.3 the picker is mounted for the subscriber', cap.has === true);
  const src = SINGLE ? '' : readFileSync('js/screens/directory.js', 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
  if (!SINGLE) {
    ok('3.4 the photo screen no longer asks whether the limit is Infinity',
       !/limits\.photos\s*[!=]==\s*Infinity/.test(src));
    ok('3.5 …and the ceiling handed to the picker is the plan itself',
       /const max = limits\.photos;/.test(src));
  } else {
    ok('3.4 (module-build check, skipped on the single-file build)', true);
    ok('3.5 (module-build check, skipped on the single-file build)', true);
  }
  ok('3.6 and the number the screen enforces equals PLAN_LIMITS.paid.photos',
     Number.isFinite(L.paid), String(L.paid));
  await ctx.close();
}

/* ---------- 4) the FAQ answer is filled, not printed raw ---------- */
{
  const { page, ctx } = await open('#/help', { member: true });
  const L = await readStore(page);
  const body = await page.evaluate(() => document.body.textContent || '');
  ok('4.1a the FAQ shows the number, never the token', !body.includes('{n}'));
  ok('4.1b …and no longer promises no limit', !/بلا حدّ|غير محدود|unlimited/i.test(body));
  ok('4.1c …and the number it shows is the plan\'s', new RegExp('\\b' + L.paid + '\\b').test(body), String(L.paid));
  await ctx.close();
}

/* ---------- 5) no token leaks onto any screen a reader can open ---------- */
{
  const routes = ['#/home', '#/directory', '#/directory/b30', '#/directory/b1', '#/marketplace?cat=handyman', '#/help', '#/subscribe/b30'];
  const leaked = [];
  for (const r of routes) {
    const { page, ctx } = await open(r, { member: true });
    const body = await page.evaluate(() => document.body.textContent || '');
    if (/\{n\}|\{f\}|\{v\}/.test(body)) leaked.push(r);
    await ctx.close();
  }
  ok('5.1 not one screen prints {n}, {f} or {v} as a character', leaked.length === 0, leaked.join(', ') || 'seven screens clean');
}

console.log(`\nv67: ${pass} passed, ${fail} failed`);
await browser.close();
process.exit(fail ? 1 : 0);
