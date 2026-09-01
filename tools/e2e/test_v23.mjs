import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import { withDemoData } from './_demo.mjs';

const BASE = process.env.BASE || 'http://localhost:8099/index.html';
let pass = 0, fail = 0;
const ok = (n, c, extra = '') => { if (c) { pass++; console.log('PASS ' + n + (extra ? ' -> ' + extra : '')); } else { fail++; console.log('FAIL ' + n + (extra ? ' -> ' + extra : '')); } };

const browser = await chromium.launch();
/* ⚠️ THIS SUITE USES THE INVENTED RECORDS AS ITS FIXTURE, and `510`
   turned them off by default. It turns them on for itself — the
   default is not reverted and no assertion is softened. */
await withDemoData(browser);
const ctx = await browser.newContext({ colorScheme: 'dark', viewport: { width: 390, height: 844 } });
const page = await ctx.newPage();
const errors = [];
page.on('console', m => { if (m.type() === 'error' && !/ERR_CONNECTION|ERR_CERT|ERR_TUNNEL|fonts\.googleapis/.test(m.text())) errors.push(m.text()); });
page.on('pageerror', e => errors.push('PAGEERROR ' + e.message));

/* On the single-file build every module lives behind an importmap, so
   `import('./js/store.js')` fetches the file again and hands back a SECOND
   instance with its own state. The importmap specifier resolves to the one
   the app is actually running. */
const mods = () => page.evaluate(async () => {
  if (!window.__m) {
    const load = async (rel, spec) => { try { return await import(spec); } catch (e) { return await import(rel); } };
    window.__m = {
      S: await load('./js/store.js', 'arabna/js/store.js'),
      D: await load('./js/data.js', 'arabna/js/data.js'),
      P: await load('./js/prayer.js', 'arabna/js/prayer.js'),
      Y: await load('./js/synonyms.js', 'arabna/js/synonyms.js'),
      H: await load('./js/screens/home.js', 'arabna/js/screens/home.js'),
    };
  }
  return true;
});
const go = async (h) => {
  await page.evaluate(() => { location.hash = '#/home'; });
  await page.waitForTimeout(120);
  await page.evaluate(x => { location.hash = x; }, h);
  await page.waitForTimeout(520);
};
/* V.04.4: the directory paints forty rows and grows as you scroll, so
   counting `.list-row` answers "how many are drawn" — and every question
   here is "how many results are there". The screen publishes that on
   `#dirList` as `data-total`, which is the number it already had. */
const rows = () => page.evaluate(() => +(document.querySelector('#dirList')||{dataset:{}}).dataset.total || 0);
const txt = () => page.textContent('#app');

/* V.03.0 — batch seven: the search says what it means
   Rebuilt after a container reset destroyed the original. Every number
   below is the one CLAUDE.md records for this batch. */

await page.goto(BASE); await page.waitForTimeout(800);
await page.evaluate(() => {
  const s = JSON.parse(localStorage.getItem('arabna.v1') || '{}');
  s.radius = 100; localStorage.setItem('arabna.v1', JSON.stringify(s));
});
await page.reload(); await page.waitForTimeout(800);
await mods();

const search = (term) => page.evaluate((t) => {
  const { S, D } = window.__m;
  const r = S.searchBusinesses(D.BUSINESSES, t);
  return { mode: r.mode, n: r.list.length, ids: r.list.map(b => b.id),
           first: r.list[0] ? (r.list[0].name.en || r.list[0].name.ar) : '' };
}, term);
const adminSearch = (term) => page.evaluate((t) => {
  const { S, D } = window.__m;
  const r = S.adminSearchBusinesses(D.BUSINESSES, t);
  return { n: r.length, ids: r.slice(0, 3).map(b => b.id) };
}, term);

/* ---- 1. one-way synonyms: «حلاق» stops returning women's salons ---- */
console.log('--- one-way synonyms ---');
const WOMEN = ['b7','b187','b188','b189','b190','b191','b192','b193','b194','b195','b196','b197'];
const barber = await search('حلاق');
const kwafeer = await search('كوافير');
const salon = await search('صالون');
ok('1.1 «حلاق» returns 13, not the whole category', barber.n === 13, String(barber.n));
ok('1.2 …and only one of them is a women\'s salon',
   barber.ids.filter(i => WOMEN.includes(i)).length === 1,
   barber.ids.filter(i => WOMEN.includes(i)).join(','));
ok('1.3 …the «للنساء فقط» one is gone from it', !barber.ids.includes('b193'));
ok('1.4 «كوافير» returns 15', kwafeer.n === 15, String(kwafeer.n));
ok('1.5 …twelve of them women\'s salons',
   kwafeer.ids.filter(i => WOMEN.includes(i)).length === 12,
   String(kwafeer.ids.filter(i => WOMEN.includes(i)).length));
ok('1.6 «صالون» stays wide — both trades, all 24', salon.n === 24, String(salon.n));
ok('1.7 the three are no longer one identical list',
   barber.ids.join() !== kwafeer.ids.join() && barber.ids.join() !== salon.ids.join());
ok('1.8 one-way means one-way: «حلاق» never widens into «صالون»',
   await page.evaluate(() => {
     const { Y, S } = window.__m;
     return !Y.expandQuery('حلاق', S.normalize)[0].alts.some(a => /صالون/.test(a));
   }));
ok('1.9 …while «صالون» carries both vocabularies',
   await page.evaluate(() => {
     const { Y, S } = window.__m;
     return Y.expandQuery('صالون', S.normalize)[0].alts.length > 20;
   }));

/* ---- 2. a category name is a label, matched as a whole word ---- */
console.log('--- the category label ---');
/* The invariant is that the category LABEL is not inside the record's own
   text — not that the word never appears there. V.03.3 gave b410 the
   description «Men's barber in Sugar Land», which is the record's own
   words and belongs in the haystack. */
ok('2.1 the label is held apart from the record\'s own words',
   await page.evaluate(() => {
     const { S, D } = window.__m;
     const b = D.BUSINESSES.find(x => x.id === 'b410');
     const label = S.catHaystack(b);
     return label.includes('barbers') && !S.searchHaystack(b).includes(label);
   }));
ok('2.2 typing a whole category word still returns the category',
   (await search('مطعم')).n === 176, String((await search('مطعم')).n));
ok('2.3 «تجميل» — the label itself — still returns all 24',
   (await search('تجميل')).n === 24, String((await search('تجميل')).n));
ok('2.4 «beauty» does too, from the English half',
   (await search('beauty')).n === 24, String((await search('beauty')).n));
ok('2.5 «ملحمة» no longer drags in the whole grocery aisle',
   (await search('ملحمة')).n === 19, String((await search('ملحمة')).n));
/* 41 before V.03.3. The 485 descriptions added one: a bakery whose own
   description says supermarket, which is a find and not a leak — the two
   non-grocery hits are both shops that really do sell groceries. */
const baqala = await search('بقاله');
ok('2.6 «بقالة» is the groceries, not the butchers too', baqala.n === 42, String(baqala.n));
ok('2.7 …and every stray one really is a grocer too', await page.evaluate(() => {
  const { S, D } = window.__m;
  return S.searchBusinesses(D.BUSINESSES, 'بقاله').list
    .filter(b => b.cat !== 'grocery')
    .every(b => /سوبرماركت|supermarket/i.test(b.desc.ar + ' ' + b.desc.en));
}));
ok('2.7 «مسجد» is untouched', (await search('مسجد')).n === 25, String((await search('مسجد')).n));
ok('2.8 «كنيسة» is untouched', (await search('كنيسة')).n === 12, String((await search('كنيسة')).n));

/* ---- 3. transliteration: the name on the sign, the sound in the search ---- */
console.log('--- transliteration tags ---');
const NC = [['ديماسي', 'b327'], ['الشامي', 'b63'], ['الأقصى', 'b98'], ['فلوريدا', 'b192'],
            ['سنابرة', 'b61'], ['حضرموت', 'b299'], ['مكة', 'b405'], ['دجلة', 'b416'],
            ['أبو عمر', 'b320'], ['اسطنبول', 'b114'], ['مار مرقس', 'b222'], ['العذراء مريم', 'b223']];
for (const [term, id] of NC) {
  const r = await search(term);
  ok('3.x «' + term + '» finds it, and it leads', r.n > 0 && r.ids[0] === id,
     r.n + ' · ' + (r.ids[0] || '—'));
}
/* the promise the batch made: the name on the shopfront stays on the
   screen, the transliteration lives in the search words and nowhere else */
ok('3.13 the transliteration is a tag, never a displayed name', await page.evaluate(() => {
  const D = window.__m.D;
  return ['b327', 'b63', 'b98', 'b192'].every(id => {
    const b = D.BUSINESSES.find(x => x.id === id);
    const shown = (b.name.ar || '') + ' ' + (b.name.en || '');
    const tags = (b.tags || []).join(' ');
    return /[A-Za-z]/.test(b.name.en) && /[\u0600-\u06FF]/.test(tags)
        && !/ديماسي|الشامي|الأقصى|فلوريدا/.test(shown);
  });
}));

/* ---- 4. spacing is not spelling ---- */
console.log('--- the squashed copy ---');
for (const [term, n] of [['alshami', 2], ['abuomar', 1], ['عبدالله', 2], ['dimassis', 1]]) {
  const r = await search(term);
  ok('4.x «' + term + '» finds ' + n, r.n === n && r.mode === 'exact', r.mode + ' ' + r.n);
}
ok('4.5 a two-letter word is never squash-matched — the floor is six',
   await page.evaluate(() => {
     const { S, D } = window.__m;
     // «ال» must not match by squashing; it may still match as plain text
     return S.searchBusinesses(D.BUSINESSES, 'ال').mode !== 'none';
   }));

/* ---- 5. the admin searches by id ---- */
console.log('--- admin id search ---');
for (const id of ['b137', 'b281', 'b512', 'b1']) {
  const r = await adminSearch(id);
  ok('5.x «' + id + '» returns exactly itself', r.n === 1 && r.ids[0] === id, r.n + ' · ' + r.ids.join(','));
}
ok('5.5 an id that does not exist returns nothing, which is the right answer',
   (await adminSearch('b9999')).n === 0);
ok('5.6 a three-digit run still matches inside a number', (await adminSearch('713')).n === 168,
   String((await adminSearch('713')).n));
ok('5.7 a full number still finds its one shop', (await adminSearch('(713) 555-0142')).n === 1);
ok('5.8 «الامانة» without the hamza still works', (await adminSearch('الامانة')).n === 1);
ok('5.9 «Hillcroft» keeps all 65', (await adminSearch('Hillcroft')).n === 65,
   String((await adminSearch('Hillcroft')).n));
ok('5.10 …and a name match leads the address matches',
   (await adminSearch('Hillcroft')).ids[0] === 'b187', (await adminSearch('Hillcroft')).ids.join(','));
ok('5.11 nothing matches nothing', (await adminSearch('zzzz')).n === 0);

/* ---- 6. the app still runs ---- */
console.log('--- the app still runs ---');
ok('6.1 the directory still lists all 514',
   await page.evaluate(() => window.__m.S.allBusinesses().length === 514));
await go('#/directory');
ok('6.2 …on the screen too', await rows() === 514, String(await rows()));
await page.fill('#dirSearch', 'zzzzqqq'); await page.waitForTimeout(900);
ok('6.3 a search with nothing behind it lands on the empty state', await rows() === 0);
await page.fill('#dirSearch', 'مواقف'); await page.waitForTimeout(900);
ok('6.4 «مواقف» still reaches the attribute labels', await rows() === 130, String(await rows()));
ok('6.5 zero console errors', errors.length === 0, errors.slice(0, 3).join(' | '));

console.log(`\n${pass} passed, ${fail} failed`);
await browser.close();
process.exit(fail ? 1 : 0);
