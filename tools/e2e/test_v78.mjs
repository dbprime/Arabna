/* V.10.2 — 625 (appendix 3): the price knows its section.
 *
 * ⚠️ FOUND ON THE LIVE HOST, NOT BY THE NET. A «job wanted» was posted, a
 * price was demanded that has no meaning, «00» was typed to get past the
 * field — and 0 in this app is the word «مجاني», written in the comment
 * over `checkListingPrice`. So the advert published saying, to whoever
 * read it, «I work for nothing».
 *
 * The whole chain came from ONE fault: the field did not go away. What
 * followed it — a meaningless number typed, then read as a real value —
 * is the correct behaviour of the app on a wrong input.
 *
 *   jobs      no price field at all. Not required, not stored, not shown.
 *   handyman  the field stays, and the unit is SAID — in the label, glued
 *             to the box, and again on the card. Three places or none:
 *             «$50» on a card with no unit is read as the whole job.
 *   the rest  untouched, to the letter.
 *
 * ⚠️ AND THE RULE IS DERIVED FROM `MARKET_CATS`, never written in the
 * screen — item 1.4 is what holds that, and it is the item that keeps the
 * next section with no price from being declared in two places that part.
 */
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import { readFileSync } from 'node:fs';
import { mockSupabase, MOCK_CODE } from './_supabase.mjs';

const BASE = process.env.BASE || 'http://localhost:8099/index.html';
const ROOT = new URL('../../', import.meta.url).pathname;
let pass = 0, fail = 0;
const ok = (n, c, extra = '') => { if (c) { pass++; console.log('PASS ' + n + (extra ? ' -> ' + extra : '')); }
  else { fail++; console.log('FAIL ' + n + (extra ? ' -> ' + extra : '')); } };

const read = f => readFileSync(ROOT + f, 'utf8');
/* ⚠️ comments stripped before any «does the code do X» check — this file's
   own subject is a section name, and the comments here and in the sources
   name it repeatedly. A check that reads the prose about the code reports
   the fault it exists to prevent (test_v53, and again in 430). */
const code = f => read(f).replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

const browser = await chromium.launch();
const errors = [];
const wire = p => {
  p.on('pageerror', e => errors.push('PAGEERROR ' + e.message.slice(0, 140)));
  p.on('console', m => { if (m.type() === 'error' &&
    !/supabase\.co|fonts\.googleapis/.test((m.location() && m.location().url) || '') &&
    !/ERR_CONNECTION|ERR_CERT|ERR_TUNNEL|ERR_NAME|ERR_FAILED|fonts\.googleapis|supabase\.co/.test(m.text()))
    errors.push(m.text().slice(0, 140)); });
};
const fresh = async (opts = {}) => {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  await ctx.route('**/fonts.googleapis.com/**', r => r.abort());
  await mockSupabase(ctx, opts);
  const p = await ctx.newPage(); wire(p);
  return { ctx, p };
};
const open = async (p, hash = '#/home') => {
  await p.goto(BASE + hash, { waitUntil: 'domcontentloaded' });
  await p.waitForTimeout(900);
  await p.evaluate(async () => {
    window.__S = await import('arabna/js/store.js').catch(() => import('./js/store.js'));
    window.__U = await import('arabna/js/ui.js').catch(() => import('./js/ui.js'));
    window.__D = await import('arabna/js/data.js').catch(() => import('./js/data.js'));
  });
};
/* a real account, taken to tier 2 the way the app takes anybody there */
const member = async (p) => {
  await p.evaluate(async ([c]) => {
    const S = window.__S;
    await S.signUp({ name: 'Test Person', email: 'jobs@a.app', password: 'Qx7#mVzt2026', phone: '' });
    await S.confirmEmail(c);
    S.state.user = Object.assign({}, S.state.user,
      { phone: '(713) 466-9182', phoneVerified: true, emailVerified: true });
    S.save();
  }, [MOCK_CODE]);
};
const catState = (p) => p.evaluate(() => {
  const f = document.querySelector('#priceField');
  const i = document.querySelector('#pPrice');
  const u = document.querySelector('#pPriceUnit');
  const l = document.querySelector('#pPriceLabel');
  return {
    fieldShown: !!(f && getComputedStyle(f).display !== 'none'),
    label: l ? l.textContent.trim() : null,
    unitShown: !!(u && getComputedStyle(u).display !== 'none'),
    unitText: u ? u.textContent.trim() : null,
    unitBox: u ? Math.round(u.getBoundingClientRect().width) : 0,
    padEnd: i ? getComputedStyle(i).paddingInlineEnd : null,
  };
});
const pick = async (p, cat) => { await p.selectOption('#pCat', cat); await p.waitForTimeout(150); };

/* ===== 1. the rule lives in MARKET_CATS, and only there ===== */
{
  const { ctx, p } = await fresh();
  await open(p);
  const rows = await p.evaluate(() => window.__D.MARKET_CATS.map(c =>
    ({ id: c.id, noPrice: !!c.noPrice, hourly: !!c.hourly, freeOnly: !!c.freeOnly })));
  const jobs = rows.find(r => r.id === 'jobs');
  const handy = rows.find(r => r.id === 'handyman');
  ok('1.1 the jobs row declares noPrice', !!(jobs && jobs.noPrice), JSON.stringify(jobs));
  ok('1.2 …and it is the only section with it',
     rows.filter(r => r.noPrice).map(r => r.id).join(',') === 'jobs',
     rows.filter(r => r.noPrice).map(r => r.id).join(','));
  ok('1.3 handyman declares hourly, and it is the only one',
     !!(handy && handy.hourly) && rows.filter(r => r.hourly).length === 1,
     rows.filter(r => r.hourly).map(r => r.id).join(','));
  /* ⚠️ freeOnly and noPrice are two different facts and must not merge:
     «Free stuff» HAS a price and it is the word «مجاني»; a job has none. */
  ok('1.4 noPrice and freeOnly are never the same section',
     !rows.some(r => r.noPrice && r.freeOnly));
  const rule = await p.evaluate(() => ({
    jobs: window.__S.catRule('jobs'),
    handyman: window.__S.catRule('handyman'),
    cars: window.__S.catRule('cars'),
  }));
  ok('1.5 catRule carries both across', rule.jobs.noPrice === true &&
     rule.handyman.hourly === true && rule.cars.noPrice === false && rule.cars.hourly === false,
     JSON.stringify(rule.cars));
  /* THE structural item: derived, never copied. A screen that names the
     section itself is a second declaration, and the two part on the day a
     third section joins. */
  const named = ['js/screens/marketplace.js', 'js/ui.js']
    .filter(f => /['"]jobs['"]/.test(code(f)));
  ok('1.6 no screen names the section itself — the rule is derived', named.length === 0, named.join(','));
  await ctx.close();
}

/* ===== 2. jobs: the field is gone, and the publish goes through ===== */
{
  const { ctx, p } = await fresh();
  await open(p, '#/post');
  await member(p);
  await p.evaluate(() => { location.hash = '#/home'; });
  await p.waitForTimeout(400);
  await p.evaluate(() => { location.hash = '#/post'; });
  await p.waitForTimeout(900);

  await pick(p, 'cars');
  const cars = await catState(p);
  ok('2.1 an ordinary section still shows the price field', cars.fieldShown === true);

  await pick(p, 'jobs');
  const jobs = await catState(p);
  ok('2.2 jobs: the price field is not drawn at all', jobs.fieldShown === false, JSON.stringify(jobs));

  await p.fill('#pTitle', 'ابحث عن عمل سائق');
  await p.fill('#pCity', 'Houston, TX');
  await p.fill('#pDesc', 'خبرة خمس سنوات في القيادة داخل المدينة');
  await p.click('#pubBtn');
  await p.waitForTimeout(1400);
  const after = await p.evaluate(() => ({
    hash: location.hash,
    rec: (window.__S.state.extraClassifieds || [])[0] || null,
    FREE: window.__S.FREE_PRICE,
  }));
  ok('2.3 …and the publish goes through with no price asked for',
     /#\/marketplace/.test(after.hash), after.hash);
  ok('2.4 the stored price is the sentinel — not 0, not \'\'',
     !!after.rec && after.rec.price === after.FREE,
     after.rec ? JSON.stringify(after.rec.price) : 'no record');
  ok('2.5 …and the unit is nowhere in the stored row',
     !!after.rec && !/ساعة|\/hr/.test(JSON.stringify(after.rec)));
  await ctx.close();
}

/* ===== 3. what a job card prints, which is the original fault ===== */
{
  const { ctx, p } = await fresh();
  await open(p);
  const lab = await p.evaluate(() => {
    const U = window.__U, F = window.__S.FREE_PRICE;
    return {
      jobsSentinel: U.priceLabel(F, 'jobs'),
      jobsFigure: U.priceLabel('$50', 'jobs'),
      freeSection: U.priceLabel(F, 'free'),
      cars: U.priceLabel('$50', 'cars'),
      handy: U.priceLabel('$50', 'handyman'),
      bare: U.priceLabel('$50'),
      bareFree: U.priceLabel(F),
      dotJobs: U.priceDotHtml(F, 'jobs'),
      dotCars: U.priceDotHtml('$50', 'cars'),
      freeWord: window.__S.t ? '' : '',
    };
  });
  /* ⚠️ THE ITEM THAT MUST GO RED IF THE FIX IS UNDONE. «مجاني» on a job
     wanted is the fault itself, and «$0» and a bare blank are the two
     wrong ways out of it. */
  ok('3.1 a job prints no «مجاني»', !/مجاني|Free/.test(lab.jobsSentinel), JSON.stringify(lab.jobsSentinel));
  ok('3.2 …and no figure either, whatever the row happens to carry',
     lab.jobsFigure === '', JSON.stringify(lab.jobsFigure));
  ok('3.3 the FREE section still says the word — the two are not merged',
     /مجاني|Free/.test(lab.freeSection), JSON.stringify(lab.freeSection));
  ok('3.4 an ordinary section prints the figure and no unit',
     lab.cars.includes('$50') && !/ساعة|\/hr/.test(lab.cars), JSON.stringify(lab.cars));
  ok('3.5 handyman prints the figure AND the unit',
     lab.handy.includes('$50') && /ساعة|\/hr/.test(lab.handy), JSON.stringify(lab.handy));
  /* the optional argument has no lying default */
  ok('3.6 a call with no section prints the figure bare',
     lab.bare.includes('$50') && !/ساعة|\/hr/.test(lab.bare), JSON.stringify(lab.bare));
  ok('3.7 …and still knows the sentinel', /مجاني|Free/.test(lab.bareFree));
  /* the separator goes with the figure, or a blank slot is left standing */
  ok('3.8 the « · » is not printed with nothing before it',
     lab.dotJobs === '' && / · $/.test(lab.dotCars), JSON.stringify(lab.dotJobs));
  ok('3.9 …and the one that does print escapes what it wraps',
     /^<span class="ltr">/.test(lab.dotCars), lab.dotCars);
  await ctx.close();
}

/* ===== 4. the job card on the screen, measured rather than reasoned ===== */
{
  const { ctx, p } = await fresh();
  await open(p, '#/post');
  await member(p);
  await p.evaluate(() => { location.hash = '#/home'; }); await p.waitForTimeout(300);
  await p.evaluate(() => { location.hash = '#/post'; }); await p.waitForTimeout(800);
  await pick(p, 'jobs');
  await p.fill('#pTitle', 'ابحث عن عمل سائق');
  await p.fill('#pCity', 'Houston, TX');
  await p.fill('#pDesc', 'خبرة خمس سنوات في القيادة داخل المدينة');
  await p.click('#pubBtn');
  await p.waitForTimeout(1400);
  await p.evaluate(() => { location.hash = '#/marketplace?cat=jobs'; });
  await p.waitForTimeout(900);
  const card = await p.evaluate(() => {
    const rows = Array.from(document.querySelectorAll('.cl-card, .cl-body'));
    const prices = Array.from(document.querySelectorAll('.cl-price'))
      .map(e => ({ txt: e.textContent.trim(), h: Math.round(e.getBoundingClientRect().height) }));
    return { prices, body: document.querySelector('#app').textContent };
  });
  ok('4.1 the job listing is on the screen', /سائق/.test(card.body));
  ok('4.2 …and its price slot carries nothing at all',
     card.prices.length > 0 && card.prices.every(x => x.txt === '' && x.h === 0),
     JSON.stringify(card.prices));
  ok('4.3 …no «مجاني» anywhere on the card', !/مجاني/.test(card.body));
  ok('4.4 …and no «$0»', !/\$0(?!\d)/.test(card.body));
  /* the detail page prints the same nothing, in a much bigger type */
  const id = await p.evaluate(() => (window.__S.state.extraClassifieds[0] || {}).id);
  await p.evaluate((i) => { location.hash = '#/marketplace/' + i; }, id);
  await p.waitForTimeout(800);
  /* ⚠️ SCOPED TO THE PRICE, and the first draft was not — it swept the
     whole detail page for «مجاني» and caught `classifiedsNote`, «حساب
     مجاني: حتى 4 إعلانات نشطة», which is the ACCOUNT's word and has
     nothing to do with this listing's price. A check that reports a
     sentence it was not written for is a red nobody can act on. */
  const det = await p.evaluate(() => {
    const e = document.querySelector('.cl-price');
    const head = e && e.parentElement ? e.parentElement.textContent : '';
    return { price: e ? e.textContent : null,
             h: e ? Math.round(e.getBoundingClientRect().height) : -1, head };
  });
  ok('4.5 the detail page says nothing about a price either',
     (det.price || '').trim() === '' && det.h === 0 && !/مجاني|Free|\$/.test(det.head),
     JSON.stringify(det.price) + ' h=' + det.h);
  await ctx.close();
}

/* ===== 5. handyman: three places, one item ===== */
{
  const { ctx, p } = await fresh();
  await open(p, '#/post');
  await member(p);
  await p.evaluate(() => { location.hash = '#/home'; }); await p.waitForTimeout(300);
  await p.evaluate(() => { location.hash = '#/post'; }); await p.waitForTimeout(800);

  await pick(p, 'handyman');
  const h = await catState(p);
  ok('5.1 the label says the unit', /بالساعة|Hourly/.test(h.label || ''), JSON.stringify(h.label));
  /* ⚠️ AND THIS IS THE ITEM, NOT THE LABEL. A heading is read once and
     forgotten; the poster is looking at the BOX while typing, with the
     price of the whole job in mind. */
  ok('5.2 …and the unit stands on the box itself, drawn and wide',
     h.unitShown === true && h.unitBox > 0 && /ساعة|\/hr/.test(h.unitText || ''),
     JSON.stringify(h));
  ok('5.3 …and the input makes room for it rather than running under it',
     parseFloat(h.padEnd) > 40, h.padEnd);

  /* live with the section, not painted once at open */
  await pick(p, 'cars');
  const c = await catState(p);
  ok('5.4 switching section takes the unit away with no reload',
     c.unitShown === false && !/بالساعة|Hourly/.test(c.label || '') && parseFloat(c.padEnd) < 40,
     JSON.stringify(c));
  await pick(p, 'handyman');
  const h2 = await catState(p);
  ok('5.5 …and brings it back', h2.unitShown === true);

  await p.fill('#pTitle', 'سباك خبرة');
  await p.fill('#pPrice', '50');
  await p.fill('#pCity', 'Houston, TX');
  await p.fill('#pDesc', 'تصليح تسريبات وتركيب سخانات');
  await p.click('#pubBtn');
  await p.waitForTimeout(1400);
  const rec = await p.evaluate(() => (window.__S.state.extraClassifieds || [])[0] || null);
  ok('5.6 the row stores the figure and NOT the unit',
     !!rec && /\$50/.test(rec.price) && !/ساعة|\/hr/.test(rec.price),
     rec ? JSON.stringify(rec.price) : 'no record');
  await p.evaluate(() => { location.hash = '#/marketplace?cat=handyman'; });
  await p.waitForTimeout(900);
  const seen = await p.evaluate(() => Array.from(document.querySelectorAll('.cl-price')).map(e => e.textContent.trim()));
  ok('5.7 …and the card prints the unit beside the figure',
     seen.some(s => /\$50/.test(s) && /ساعة|\/hr/.test(s)), JSON.stringify(seen));
  /* ⚠️ A THIRD SECTION HAS TO BE PUBLISHED, not merely visited. The
     invented records are off by default since 510, so an unseeded «cars»
     is an EMPTY list — and `!cars.some(...)` over nothing is green while
     measuring nothing. `cars.length > 0` is what makes the item bite. */
  await p.evaluate(() => { location.hash = '#/post'; });
  await p.waitForTimeout(900);
  await pick(p, 'cars');
  await p.fill('#pTitle', 'سيارة للبيع');
  await p.fill('#pPrice', '9000');
  await p.fill('#pCity', 'Houston, TX');
  await p.fill('#pDesc', 'موديل 2019 بحالة ممتازة وصيانة دورية');
  await p.click('#pubBtn');
  await p.waitForTimeout(1400);
  await p.evaluate(() => { location.hash = '#/marketplace?cat=cars'; });
  await p.waitForTimeout(900);
  const cars = await p.evaluate(() => Array.from(document.querySelectorAll('.cl-price')).map(e => e.textContent.trim()));
  ok('5.8 a third section prints no unit — it is conditional, not general',
     cars.length > 0 && cars.some(s => /9,?000/.test(s)) && !cars.some(s => /ساعة|\/hr/.test(s)),
     JSON.stringify(cars.slice(0, 4)));
  await ctx.close();
}

/* ===== 6. an old job listing carrying a price ===== */
{
  const { ctx, p } = await fresh();
  await open(p, '#/post');
  await member(p);
  /* the shape that exists on somebody's phone today: a job with a figure.
     There is no data migration — the correction lands where somebody is
     already standing, at the first edit, and is never a refusal. */
  const id = await p.evaluate(() => {
    const S = window.__S;
    const rec = { id: 'old-job-1', cat: 'jobs', title: { ar: 'وظيفة قديمة', en: 'Old job' },
      price: '⁦$300⁩', city: 'Houston, TX', desc: { ar: 'وصف', en: 'desc' },
      photos: [], mainPhoto: 0, icon: 'briefcase', status: 'live',
      when: { ar: 'اليوم', en: 'today' }, created: S.now(), owner: 'me' };
    S.state.extraClassifieds.unshift(rec);
    S.state.myListings.push(rec.id);
    S.save();
    return rec.id;
  });
  await p.evaluate((i) => { location.hash = '#/post?edit=' + i; }, id);
  await p.waitForTimeout(1000);
  const st = await catState(p);
  ok('6.1 opening it for editing hides the field', st.fieldShown === false, JSON.stringify(st));
  await p.click('#pubBtn');
  await p.waitForTimeout(1200);
  const out = await p.evaluate((i) => {
    const S = window.__S;
    const r = (S.state.extraClassifieds || []).find(c => c.id === i);
    return { price: r ? r.price : null, FREE: S.FREE_PRICE, hash: location.hash };
  }, id);
  ok('6.2 saving is not refused', !/#\/post/.test(out.hash), out.hash);
  ok('6.3 …and the old figure is corrected to the sentinel',
     out.price === out.FREE, JSON.stringify(out.price));
  await ctx.close();
}

/* ===== 7. English, and the unit's own contrast ===== */
{
  const { ctx, p } = await fresh();
  await open(p, '#/post');
  await member(p);
  await p.evaluate(() => { window.__S.state.lang = 'en'; window.__S.save(); });
  await p.evaluate(() => { location.hash = '#/home'; }); await p.waitForTimeout(300);
  await p.reload({ waitUntil: 'domcontentloaded' }); await p.waitForTimeout(900);
  await p.evaluate(() => { location.hash = '#/post'; }); await p.waitForTimeout(900);
  await pick(p, 'jobs');
  ok('7.1 EN — jobs hides the field too', (await catState(p)).fieldShown === false);
  await pick(p, 'handyman');
  const h = await catState(p);
  ok('7.2 EN — the label and the unit are both in English',
     /Hourly/.test(h.label || '') && /hr/.test(h.unitText || ''), JSON.stringify(h));

  /* ⚠️ --text-2 and not --muted. Measured on the input's own ground,
     --muted is 3.96 in dark — under the 4.5 line, and the same family as
     the standing rule that --muted is never put on --surface-2. */
  for (const [n, mode] of [['7.3', 'dark'], ['7.4', 'light']]) {
    await p.emulateMedia({ colorScheme: mode });
    await p.waitForTimeout(250);
    const cr = await p.evaluate(() => {
      const u = document.querySelector('#pPriceUnit');
      const i = document.querySelector('#pPrice');
      const num = s => (s.match(/[\d.]+/g) || []).map(Number);
      const lin = c => { c /= 255; return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); };
      const lum = ([r, g, b]) => 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
      /* the real stack under the unit: the input's tinted ground over the card */
      const stack = (el) => {
        let out = [255, 255, 255];
        const chain = [];
        for (let e = el; e; e = e.parentElement) chain.unshift(e);
        for (const e of chain) {
          const bg = num(getComputedStyle(e).backgroundColor);
          if (bg.length < 3) continue;
          const a = bg.length > 3 ? bg[3] : 1;
          if (!a) continue;
          out = [0, 1, 2].map(k => bg[k] * a + out[k] * (1 - a));
        }
        return out;
      };
      const fg = num(getComputedStyle(u).color).slice(0, 3);
      const bg = stack(i);
      const la = lum(fg), lb = lum(bg);
      return Math.round(((Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05)) * 100) / 100;
    });
    ok(n + ' the unit clears 4.5 on the input ground (' + mode + ')', cr >= 4.5, String(cr));
  }
  await p.emulateMedia({ colorScheme: null });
  await ctx.close();
}

ok('8.1 zero console errors across the run', errors.length === 0, errors.slice(0, 3).join(' | '));

await browser.close();
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
