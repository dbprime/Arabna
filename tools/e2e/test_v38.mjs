/* V.04.4 — the four roles, and the doors each may and may not open.

   `#/boost` let a signed-in stranger pin somebody else's listing to the
   top of the marketplace and had the receipt written in their name. It
   was not a screen fault — every screen worked exactly as built. It was a
   ROLE fault, and nothing in the net asked the question this suite asks:
   with THIS reader, on THIS screen, what is allowed?

   Every other suite checks one screen in one state. This one checks one
   state across many screens, which is the axis none of them cover. */
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import { withDemoData } from './_demo.mjs';

import { unlockAdmin } from './_admin.mjs';
const BASE = process.env.BASE || 'http://localhost:8099/index.html';
let pass = 0, fail = 0;
const ok = (n, c, extra = '') => { if (c) { pass++; console.log('PASS ' + n + (extra ? ' -> ' + extra : '')); } else { fail++; console.log('FAIL ' + n + (extra ? ' -> ' + extra : '')); } };

const browser = await chromium.launch();
/* ⚠️ THIS SUITE USES THE INVENTED RECORDS AS ITS FIXTURE, and `510`
   turned them off by default. It turns them on for itself — the
   default is not reverted and no assertion is softened. */
await withDemoData(browser);
const errors = [];

const asReader = async (seed) => {
  const ctx = await browser.newContext({ locale: 'ar', viewport: { width: 390, height: 844 } });
  await ctx.addInitScript(s => localStorage.setItem('arabna.v1', JSON.stringify(s)), seed);
  const page = await ctx.newPage();
  page.on('console', m => { if (m.type() === 'error' && !/ERR_|fonts\.googleapis/.test(m.text())) errors.push(m.text().slice(0, 110)); });
  page.on('pageerror', e => errors.push('PAGEERROR ' + e.message.slice(0, 110)));
  return { ctx, page };
};
const at = async (page, route) => {
  await page.goto(BASE + route, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(700);
  return {
    hash: await page.evaluate(() => location.hash),
    text: await page.evaluate(() => (document.querySelector('#app') || document.body).innerText),
  };
};

const BASE_STATE = {
  lang: 'ar', geoGranted: true,
  geo: { lat: 29.7858, lng: -95.8245, at: Date.now() },
  location: { zip: '77494', city: 'Katy', state: 'TX' },
};

/* ---------- 1) a visitor with no account ---------- */
{
  const { ctx, page } = await asReader(BASE_STATE);
  /* The screens that hold a reader's own content. Reaching one signed out
     must land on the sign-in door or say so on the screen itself. */
  const shut = ['#/my-ads', '#/my-reviews', '#/saved', '#/messages', '#/my-business'];
  const open = [];
  for (const r of shut) {
    const o = await at(page, r);
    const guarded = /#\/auth\//.test(o.hash) || /تسجيل|حساب|Sign in|account/i.test(o.text);
    if (!guarded) open.push(r);
  }
  ok('1.1 a visitor is not shown a private screen', open.length === 0, open.join(' '));

  /* `#/my-subscription` and `#/receipts` are deliberately NOT in that list.
     A visitor has no subscription and no receipts, so what they meet is a
     designed empty state holding nobody's data — and on the first one, the
     door to buy. That is the same rule «أعلن معنا» follows: a page that
     sells is open, and the gate stands at the payment. What must never
     happen is a figure or a record appearing on either. */
  const leaked = [];
  for (const r of ['#/my-subscription', '#/receipts']) {
    const o = await at(page, r);
    const empty = /لا يوجد اشتراك|لا إيصالات|No subscription|No receipts/.test(o.text);
    const record = /\$\d|[A-Z]{2,}-\d{3,}/.test(o.text);
    if (!empty || record) leaked.push(r + (record ? ' (a figure or a record)' : ' (no empty state)'));
  }
  ok('1.1b …and the two selling screens show an empty state, never a record',
     leaked.length === 0, leaked.join(' '));

  const pub = ['#/directory', '#/marketplace', '#/magazine', '#/prayer', '#/newcomer', '#/help'];
  const blocked = [];
  for (const r of pub) {
    const o = await at(page, r);
    if (/#\/auth\//.test(o.hash) || o.text.trim().length < 40) blocked.push(r);
  }
  ok('1.2 …and every public screen is open to them', blocked.length === 0, blocked.join(' '));
  await ctx.close();
}

/* ---------- 2) an account holder who owns nothing ---------- */
{
  const { ctx, page } = await asReader(Object.assign({}, BASE_STATE, {
    user: { id: 'u9', name: 'زائر مسجّل', email: 'u9@t.co', emailVerified: true },
    myListings: [], myBusinessId: null,
  }));
  const o = await at(page, '#/boost/c1');
  ok('2.1 an account holder may not boost a listing they do not own',
     !/#\/boost\//.test(o.hash), o.hash);

  const e = await at(page, '#/business/edit/b1');
  ok('2.2 …nor edit a business they do not own', !/#\/business\/edit\//.test(e.hash), e.hash);

  const v = await at(page, '#/verify-business/b1');
  ok('2.3 …nor ask for a badge on one', !/#\/verify-business\//.test(v.hash), v.hash);

  const p = await at(page, '#/business/photos/b1');
  ok('2.4 …nor add photos to one', !/#\/business\/photos\//.test(p.hash), p.hash);

  /* the one the V.03.3 audit found: the payment path had no guard at all */
  const s = await at(page, '#/subscribe-consent/b1');
  ok('2.5 …nor buy a stranger\'s shop a subscription',
     !/#\/subscribe-consent\//.test(s.hash) && !/\$29/.test(s.text), s.hash);
  await ctx.close();
}

/* ---------- 3) the owner of a business ---------- */
{
  const { ctx, page } = await asReader(Object.assign({}, BASE_STATE, {
    user: { id: 'u1', name: 'صاحب نشاط', email: 'o@t.co', emailVerified: true, phoneVerified: true },
    myBusinessId: 'b1', ownedBusinesses: ['b1'],
  }));
  const e = await at(page, '#/business/edit/b1');
  ok('3.1 the owner reaches their own edit screen', /#\/business\/edit\/b1/.test(e.hash), e.hash);
  const other = await at(page, '#/business/edit/b2');
  ok('3.2 …and not somebody else\'s', !/#\/business\/edit\/b2/.test(other.hash), other.hash);
  await ctx.close();
}

/* ---------- 4) the panel ---------- */
{
  const { ctx, page } = await asReader(BASE_STATE);
  const o = await at(page, '#/admin');
  /* ⚠️ REVERSED BY 630: no device password — with no staff session the
     panel shows no tab and says the true reason, and no password field. */
  ok('4.1 with no staff session the panel is shut, shows no tab, and asks for no password',
     !/المراجعة|Moderation/.test(o.text) && (await page.$$('input[type=password]')).length === 0
     && (await page.$$('#adminDenied')).length === 1);

  await unlockAdmin(page);

  const body = await page.evaluate(() => (document.querySelector('#app') || document.body).innerText);
  ok('4.2 …and opens once it is claimed', /المراجعة|Moderation/.test(body), body.slice(0, 60).replace(/\s+/g, ' '));

  /* THE MOST IMPORTANT LINE IN THIS SUITE. The staff password is checked
     for not being stored as text on every daily run — so the day somebody
     goes back to storing it the easy way, the check falls that morning
     and not a month later. */
  const stored = await page.evaluate(() => localStorage.getItem('arabna.v1') || '');
  /* 630: the lock left the device altogether — so what must never come
     back is ANY device credential, hash or not */
  ok('4.3 no staff credential of any kind is stored on the device',
     !/"adminAuth"/.test(stored) && !/"hash"/.test(stored) && !/"salt"/.test(stored));

  for (const tab of ['queue', 'mag', 'ads', 'events', 'dir', 'mkt', 'stats', 'set']) {
    const el = await page.$(`[data-t="${tab}"]`);
    if (!el) { ok(`4.4 tab ${tab} exists`, false); continue; }
    await el.click();
    await page.waitForTimeout(500);
    const info = await page.evaluate(() => {
      const b = document.querySelector('#aBody') || document.querySelector('#app') || document.body;
      const t = (b.innerText || '').trim();
      return { n: t.length, raw: /<[a-zA-Z][^>]*>/.test(t), nul: /\bundefined\b|\[object Object\]/.test(t) };
    });
    ok(`4.4 tab ${tab} draws clean`, info.n > 20 && !info.raw && !info.nul, info.n + ' chars');
  }

  /* 605 — the article form was borrowing the marketplace's sign.
     `t('titleLabel')` is a SHARED key and its owner is the post-a-listing
     form, where it correctly reads «عنوان الإعلان». The magazine editor
     reached for the same key, so whoever opened that tab to write an
     ARTICLE was greeted by the word «إعلان». The key was not written
     wrong — it was borrowed wrong, and the fix follows the local idiom:
     four of the six fields around it already carry their own conditional.

     ⚠️ AND BOTH LANGUAGES ARE MEASURED HERE, which the batch file did not
     ask for and its reasoning shows why it should be. It said run.sh runs
     the suite «in Arabic and in English» — measured, run.sh varies the
     BUILD (index.html · index-single-file.html) and this suite seeds
     `lang: 'ar'` unconditionally, so it never runs in English at all.
     The fix is a conditional on the language, so asserting one side would
     leave the other half of the very line being fixed unguarded. */
  const titleLabelOf = () => page.evaluate(() => {
    const input = document.querySelector('#artTitle');
    const field = input && input.closest('.field');
    const label = field && field.querySelector('.label');
    return label ? label.textContent.trim() : null;
  });

  await page.click('[data-t="mag"]');
  await page.waitForTimeout(400);
  const magAr = await titleLabelOf();
  ok('4.5 the article title field carries its own label, not the marketplace one',
     magAr === 'عنوان المقال', String(magAr));

  /* ⚠️ and the shared key's real owner is untouched: fixing one screen by
     breaking another is not a fix. */
  await page.evaluate(() => { location.hash = '#/post'; });
  await page.waitForTimeout(800);
  /* ⚠️ the label's OWN words, not its textContent: the marketplace label
     wraps a live character counter (`.ch-count`), so the whole node reads
     «عنوان الإعلان\n 0 / 80». The batch file's own version of this check
     compared the full textContent against the bare string and would have
     been red on a correct tree. */
  const mkt = await page.evaluate(() => {
    const l = [...document.querySelectorAll('.field .label')]
      .find(el => /عنوان/.test(el.textContent));
    if (!l) return null;
    const c = l.cloneNode(true);
    c.querySelectorAll('.ch-count').forEach(x => x.remove());
    return c.textContent.trim();
  });
  ok('4.6 the marketplace post form keeps its own title label', mkt === 'عنوان الإعلان', String(mkt));
  await ctx.close();
}

/* ---------- 4b) the same two fields, with the interface in English ----------
   ⚠️ the language is SEEDED and the page loaded with it, never switched in
   place: `admin.js` reads `S.state.lang` — the store's value — while
   i18n's own `setLang` moves a variable inside that module. Switching one
   would leave the other saying Arabic, and the check would measure the
   harness rather than the app. This is how v40 and v65 do it. */
{
  const { ctx, page } = await asReader(Object.assign({}, BASE_STATE, { lang: 'en' }));
  await at(page, '#/admin');
  await unlockAdmin(page);

  await page.click('[data-t="mag"]');
  await page.waitForTimeout(400);
  const magEn = await page.evaluate(() => {
    const input = document.querySelector('#artTitle');
    const field = input && input.closest('.field');
    const label = field && field.querySelector('.label');
    return label ? label.textContent.trim() : null;
  });
  ok('4.5b …and its English half is the article\'s too', magEn === 'Article title', String(magEn));

  await page.evaluate(() => { location.hash = '#/post'; });
  await page.waitForTimeout(800);
  const mktEn = await page.evaluate(() => {
    const l = [...document.querySelectorAll('.field .label')]
      .find(el => /title/i.test(el.textContent));
    if (!l) return null;
    const c = l.cloneNode(true);
    c.querySelectorAll('.ch-count').forEach(x => x.remove());
    return c.textContent.trim();
  });
  ok('4.6b …and the marketplace keeps its own in English too',
     mktEn === 'Listing title', String(mktEn));
  await ctx.close();
}

ok('99 zero console errors', errors.length === 0, errors.slice(0, 3).join(' | '));
console.log(`\n${pass} passed, ${fail} failed`);
await browser.close();
process.exit(fail ? 1 : 0);
