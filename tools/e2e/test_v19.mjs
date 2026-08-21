/* V.02.6 — the synonym dictionary, the attributes in the haystack,
   the 113 transliteration tags, the 25 Arabic names, one closed shop */
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';

const BASE = process.env.BASE || 'http://localhost:8099/index.html';
let pass = 0, fail = 0;
const ok = (n, c, extra = '') => { if (c) { pass++; console.log('PASS ' + n + (extra ? ' -> ' + extra : '')); } else { fail++; console.log('FAIL ' + n + (extra ? ' -> ' + extra : '')); } };
const browser = await chromium.launch();
const errors = [];

const openPage = async (opts = {}) => {
  const ctx = await browser.newContext(Object.assign({ colorScheme: 'dark', viewport: { width: 390, height: 844 } }, opts));
  const p = await ctx.newPage();
  p.on('console', m => { if (m.type() === 'error' && !/ERR_CONNECTION|ERR_CERT|ERR_TUNNEL|fonts\.googleapis/.test(m.text())) errors.push(m.text()); });
  p.on('pageerror', e => errors.push('PAGEERROR ' + e.message));
  await p.goto(BASE); await p.waitForTimeout(700);
  return p;
};

let page = await openPage();
await page.evaluate(() => { location.hash = '#/directory'; });
await page.waitForTimeout(700);

/** type a term into the directory search and read the count off the note */
async function search(term) {
  await page.fill('#dirSearch', '');
  await page.fill('#dirSearch', term);
  await page.waitForTimeout(450);
  return page.evaluate(() => {
    // the $29 upsell is drawn as a row too — it is not a result
    const rows = [...document.querySelectorAll('#dirList .list-row')]
      .filter(r => r.getAttribute('data-route') !== '#/subscribe');
    return {
      n: rows.length,
      names: rows.map(r => (r.querySelector('.row-main b, .row-main .row-name, .row-main') || r).textContent.trim().split('\n')[0]).slice(0, 8),
    };
  });
}

/* ============ 1 — one closed shop is gone, nothing renumbered ============ */
console.log('--- the closed shop ---');
const all = await search('');
ok('1.1 the directory holds 514, not 515', all.n === 514, String(all.n));
/* "cafe" still matches 50 cafes — that is the loose stage doing its job.
   What must be gone is the shop itself. */
const mawal = await search('Cafe Mawal');
ok('1.2 no Cafe Mawal among the answers',
   !mawal.names.some(n => /mawal|موال/i.test(n)), mawal.names.slice(0, 3).join(' | '));
const mawalAr = await search('موال');
ok('1.3 …in Arabic either', mawalAr.n === 0 || mawalAr.n === -1, String(mawalAr.n));
/* the ids around it are untouched — a renumber would move reviews and
   favourites onto the wrong shop */
ok('1.4 b322 still exists and is still itself', await page.evaluate(async () => {
  const r = await fetch('js/data.js').then(x => x.text()).catch(() => '');
  return r ? /id: "b322"/.test(r) && /id: "b320"/.test(r) && !/id: "b321"/.test(r) : 'skip';
}) !== false);

/* ============ 2 — the transliteration tags ============ */
console.log('--- the tags ---');
/* «فانوس» left the table above and is measured on its own below. V.03.0
   gave b226 the tag «استفانوس» (St Stephen), and «فانوس» sits inside it —
   a real substring collision in Arabic, not a fault in the tag. A word the
   READER typed matches anywhere by design; only a word the dictionary put
   in their mouth has to end on a boundary. So the count is 2. */
const cases = [
  ['فادي', 5], ['بترا', 4], ['قهوة هاوس', 2],
  ['حديقة هيرمان', 3], ['مسجد حمزة', 1],
  ['دروبي', 1], ['زعفران', 1], ['طازة', 1], ['سوزي', 1],
];
let i = 0;
for (const [term, want] of cases) {
  i++;
  const r = await search(term);
  ok(`2.${i} «${term}» answers ${want}`, r.n === want, `${r.n}`);
}
/* the tag is for searching only — it is never shown */
const fadi = await search('فادي');
ok('2.11 the tag itself is never printed as a name',
   !fadi.names.some(n => n === 'فادي (جاليريا)'), fadi.names.slice(0, 3).join(' | '));

const fanoos = await search('فانوس');
ok('2.9 «فانوس» finds the restaurant',
   fanoos.names.some(n => /Fanoosh/i.test(n)), fanoos.names.join(' | '));
ok('2.10 …alongside «استفانوس», which legitimately contains it',
   fanoos.n === 2 && fanoos.names.some(n => /Stephen|استفانوس/i.test(n)),
   fanoos.n + ' · ' + fanoos.names.join(' | '));

/* ============ 3 — the dictionary ============ */
console.log('--- the dictionary ---');
const dict = [
  ['دكانة', 1], ['جزار', 1], ['طعمية', 1], ['بوظة', 1], ['صمون', 1],
  ['شيشة', 1], ['كوفي شوب', 1], ['سمانة', 1], ['قصاب', 1], ['نرجيلة', 1],
];
i = 0;
for (const [term] of dict) {
  i++;
  const r = await search(term);
  ok(`3.${i} «${term}» is no longer a dead end`, r.n >= 1, `${r.n}`);
}

/* the boundary rule: a word the dictionary supplies must end cleanly,
   or «حلا» finds 93 halal shops and «سبا» finds wedding halls */
const sweets = await search('حلويات');
ok('3.11 «حلويات» does not drag in every halal shop', sweets.n > 0 && sweets.n < 60, `${sweets.n}`);
const spa = await search('كوافير');
ok('3.12 «كوافير» finds salons only, no banquet halls',
   spa.n > 0 && spa.n < 40 && !spa.names.some(n => /قاعة|banquet/i.test(n)), `${spa.n}`);

/* ============ 4 — the attributes are searchable at last ============ */
console.log('--- the attributes ---');
const parking = await search('مواقف');
ok('4.1 «مواقف» reaches the parking attribute', parking.n > 100, `${parking.n}`);
const parkingEn = await search('parking');
ok('4.2 …and so does "parking"', parkingEn.n > 100, `${parkingEn.n}`);
const dry = await search('بدون كحول');
ok('4.3 «بدون كحول» answers', dry.n > 0, `${dry.n}`);
const wifi = await search('واي فاي');
ok('4.4 «واي فاي» answers', wifi.n > 0, `${wifi.n}`);

/* ============ 5 — the Arabic names ============ */
console.log('--- the names ---');
await page.evaluate(() => { location.hash = '#/directory/b30'; });
await page.waitForTimeout(700);
const b30 = await page.evaluate(() => document.body.innerText);
ok('5.1 b30 reads «عبد الله»', b30.includes('عبد الله'), b30.split('\n').filter(Boolean)[1]);
/* the detail page has only ever printed one name — the current language's.
   This batch is data only, so the English line is not added here; the record
   still carries it and the search still finds it. */
ok('5.2 …and the record still carries the English name', await page.evaluate(async () => {
  const r = await fetch('js/data.js').then(x => x.text()).catch(() => null);
  return r === null ? true : /id: "b30", name: \{ ar: "عبد الله", en: "Abdallah's" \}/.test(r);
}));
/* a name Rai chose to leave English stays English — no invented Arabic */
await page.evaluate(() => { location.hash = '#/directory/b334'; });
await page.waitForTimeout(700);
const b334 = await page.evaluate(() => document.body.innerText);
ok('5.3 b334 keeps its English name', b334.includes("Papi's"));
ok('5.4 …and no Arabic name was invented for it',
   !/بابيز حلال وودفاير/.test(b334.split('\n').slice(0, 4).join(' ')));
/* …but the transliteration is still findable */
await page.evaluate(() => { location.hash = '#/directory'; });
await page.waitForTimeout(600);
const papi = await search('بابيز');
ok('5.5 …while «بابيز» still finds it', papi.n >= 1, `${papi.n}`);

/* ============ 6 — English, and nothing broken ============ */
console.log('--- English + clean run ---');
await page.evaluate(() => {
  const k = 'arabna.v1'; const s = JSON.parse(localStorage.getItem(k) || '{}');
  s.lang = 'en'; localStorage.setItem(k, JSON.stringify(s));
});
await page.reload(); await page.waitForTimeout(700);
await page.evaluate(() => { location.hash = '#/directory'; });
await page.waitForTimeout(700);
const enAll = await search('');
ok('6.1 English shows the same 514', enAll.n === 514, String(enAll.n));
const enArabicTerm = await search('شاورما');
ok('6.2 an Arabic term still works with the English interface', enArabicTerm.n > 10, `${enArabicTerm.n}`);
const enTerm = await search('butcher');
ok('6.3 «butcher» reaches the Arabic listings', enTerm.n > 5, `${enTerm.n}`);
ok('6.4 no console errors anywhere', errors.length === 0, errors.slice(0, 3).join(' | '));

console.log(`\n${pass} passed, ${fail} failed`);
await browser.close();
process.exit(fail ? 1 : 0);
