/* Runs every word in the synonym dictionary against the real 515
   listings. A synonym that returns nothing is a lie; a synonym that
   returns the wrong trade is worse. Both are printed. */

import { BUSINESSES, CATEGORIES } from '../js/data.js';
import { bothPacks } from '../js/i18n.js';
import { SYNONYM_GROUPS, expandQuery, hayMatches, catMatches, squash } from '../js/synonyms.js';

/* the proposed haystack: what searchHaystack() indexes today PLUS the
   attribute labels, which it does not index at all — see the report */
const PACKS = bothPacks();
const attrLabel = (id) => {
  const k = 'attr' + id[0].toUpperCase() + id.slice(1);
  return [PACKS.ar[k], PACKS.en[k]].filter(Boolean).join(' ');
};

function normalize(str) {
  return String(str == null ? '' : str)
    .toLowerCase()
    .replace(/[ـ]/g, '')
    .replace(/[ً-ٰٟ]/g, '')
    .replace(/[آأإٱ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ؤ/g, 'و')
    .replace(/ئ/g, 'ي')
    .replace(/ة/g, 'ه')
    .trim();
}

const HAY = new Map(), SQ = new Map(), CAT = new Map();
const catName = (id) => {
  const c = CATEGORIES.find(x => x.id === id);
  return c ? normalize([PACKS.ar[c.key], PACKS.en[c.key]].filter(Boolean).join(' ')) : '';
};
for (const b of BUSINESSES) {
  const parts = [
    b.name?.ar, b.name?.en, b.desc?.ar, b.desc?.en, b.address,
    ...(b.tags || []),
    ...(b.attributes || []).map(attrLabel),
  ];
  const hay = normalize(parts.filter(Boolean).join(' '));
  HAY.set(b.id, hay);
  SQ.set(b.id, squash(hay));
  /* the category name is held apart and matched as a whole word — the
     store does exactly this, and the two must not drift */
  CAT.set(b.id, catName(b.cat));
}

const hits = (word) => BUSINESSES.filter(b => HAY.get(b.id).includes(normalize(word)));

/** what the search returns today (no synonyms) vs with them */
function withSyn(term) {
  const entries = expandQuery(term, normalize);
  return BUSINESSES.filter(b => {
    const hay = HAY.get(b.id);
    return entries.every(e => hayMatches(hay, e, SQ.get(b.id)) || catMatches(CAT.get(b.id), e));
  });
}

const catOf = (b) => b.cat;

let deadWords = [], deadGroups = [], wins = [];

for (const group of SYNONYM_GROUPS) {
  let groupTotal = 0;
  for (const word of group) {
    const n = hits(word).length;
    groupTotal += n;
    if (n === 0) deadWords.push([word, group[0]]);
    else {
      const before = n;
      const after = withSyn(word).length;
      if (after > before) wins.push([word, before, after]);
    }
  }
  if (groupTotal === 0) deadGroups.push(group[0]);
}

console.log('=== المجموعات:', SYNONYM_GROUPS.length,
            '| الكلمات:', SYNONYM_GROUPS.reduce((n, g) => n + g.length, 0));
console.log('=== مجموعات لا شيء خلفها إطلاقاً:', deadGroups.length, deadGroups);
console.log('=== كلمات وحدها ترجع صفراً (طبيعي — المرادف يغطيها):', deadWords.length);

wins.sort((a, b) => (b[2] - b[1]) - (a[2] - a[1]));
console.log('\n=== أكبر ٣٠ مكسب (قبل → بعد) ===');
for (const [w, b, a] of wins.slice(0, 30)) console.log(`${w}: ${b} → ${a}`);

/* the cases that decide whether this was worth doing: words that
   return NOTHING today and something real with the dictionary */
console.log('\n=== كان صفراً وصار له نتائج ===');
let rescued = 0;
for (const group of SYNONYM_GROUPS) {
  for (const word of group) {
    if (hits(word).length === 0) {
      const after = withSyn(word);
      if (after.length) {
        rescued++;
        const cats = [...new Set(after.map(catOf))].slice(0, 3).join(', ');
        console.log(`${word}: 0 → ${after.length}  (${cats})`);
      }
    }
  }
}
console.log('المجموع المُنقَذ:', rescued);

/* the danger check: does a precise word drag in the wrong trade? */
console.log('\n=== فحص الخلط ===');
const PROBES = [
  ['حلاق', ['beauty']], ['كوافير', ['beauty']], ['صالون', ['beauty']],
  ['ملحمه', ['grocery']], ['بقاله', ['grocery']],
  ['مسجد', ['worship']], ['كنيسه', ['worship']],
  ['شاورما', ['restaurants', 'cafe']], ['ارجيله', ['cafe', 'restaurants', 'shopping']],
  ['محامى', ['lawyers']], ['ضرائب', ['finance']],
  ['حديقه', ['outings']], ['ترامبولين', ['outings']],
];
for (const [word, expected] of PROBES) {
  const res = withSyn(word);
  const byCat = {};
  for (const b of res) byCat[catOf(b)] = (byCat[catOf(b)] || 0) + 1;
  const off = Object.entries(byCat)
    .filter(([c]) => !expected.includes(c))
    .sort((a, b) => b[1] - a[1]);
  const offTotal = off.reduce((n, x) => n + x[1], 0);
  const share = res.length ? Math.round(offTotal / res.length * 100) : 0;
  console.log(`${word}: ${res.length} نتيجة · خارج المتوقع ${offTotal} (${share}%)` +
              (off.length ? ' ← ' + off.slice(0, 4).map(x => x[0] + ':' + x[1]).join(' ') : ''));
}
