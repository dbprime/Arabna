import { STRINGS } from '../../js/i18n.js';
import { CATEGORIES, ATTRIBUTES, ATTR_GROUPS, EVENT_TYPES } from '../../js/data.js';
const ar = STRINGS.ar, en = STRINGS.en;
let bad = 0;
const need = [];
CATEGORIES.forEach(c => need.push(c.key));
CATEGORIES.filter(c => c.shortKey).forEach(c => need.push(c.shortKey));
ATTR_GROUPS.forEach(g => need.push(g.key));
ATTRIBUTES.forEach(a => need.push(a.key));
EVENT_TYPES.forEach(e => need.push(e.key));
for (const k of need) {
  if (!ar[k]) { console.log('MISSING ar:', k); bad++; }
  if (!en[k]) { console.log('MISSING en:', k); bad++; }
}
// every attribute key must be derivable from its id, and unique
const ids = new Set();
ATTRIBUTES.forEach(a => {
  const expect = 'attr' + a.id[0].toUpperCase() + a.id.slice(1);
  if (a.key !== expect) { console.log('KEY MISMATCH', a.id, a.key); bad++; }
  if (ids.has(a.id)) { console.log('DUP ID', a.id); bad++; }
  ids.add(a.id);
  if (!ATTR_GROUPS.some(g => g.id === a.group)) { console.log('UNKNOWN GROUP', a.id, a.group); bad++; }
});
// every category referenced by an attribute must exist
const catIds = new Set(CATEGORIES.map(c => c.id));
ATTRIBUTES.forEach(a => {
  if (a.cats === '*') return;
  a.cats.forEach(c => { if (!catIds.has(c)) { console.log('UNKNOWN CAT', a.id, c); bad++; } });
});
// no duplicate keys inside a pack (a later one would silently win)
for (const [name, pack] of [['ar', ar], ['en', en]]) {
  const seen = Object.keys(pack);
  if (new Set(seen).size !== seen.length) { console.log('dup keys in', name); bad++; }
}
// every UI string exists in BOTH languages — the project's rule 4
const onlyAr = Object.keys(ar).filter(k => !(k in en));
const onlyEn = Object.keys(en).filter(k => !(k in ar));
onlyAr.forEach(k => { console.log('EN MISSING:', k); bad++; });
onlyEn.forEach(k => { console.log('AR MISSING:', k); bad++; });

console.log(bad ? `\n${bad} problems` : `\nclean: ${need.length} derived keys, ${Object.keys(ar).length} strings, ${ATTRIBUTES.length} attributes`);
process.exit(bad ? 1 : 0);
