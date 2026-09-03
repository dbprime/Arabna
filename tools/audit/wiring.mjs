/* Static checks — no browser, no server, seconds to run.

   These catch the class of fault that never shows on a screen until the
   one day it does: a key called and never defined, a pack that drifted
   out of step with the other, an icon that does not exist, and the same
   rule written twice in two places so one can be fixed and the other
   forgotten. That last one is what `esc()` was before V.03.6 — seven
   copies, and the fifth screen written afterwards had none. */
import fs from 'fs';
import path from 'path';
import { pathToFileURL } from 'node:url';

const R = path.resolve(process.argv[2] || '.');
const read = p => fs.readFileSync(path.join(R, p), 'utf8');
const files = ['js/app.js', 'js/ui.js', 'js/store.js', 'js/data.js', 'js/icons.js', 'js/feasts.js',
  'js/prayer.js', 'js/synonyms.js',
  ...fs.readdirSync(path.join(R, 'js/screens')).map(f => 'js/screens/' + f)];
const src = Object.fromEntries(files.map(f => [f, read(f)]));
const i18n = read('js/i18n.js');
const at = (f, i) => f + ':' + (src[f].slice(0, i).split('\n').length);

let pass = 0, fail = 0;
/* 5, 6 and 7 are NOTES and not failures, deliberately. A check that fails
   every day on something known and deferred is ignored inside a week, and
   then its failure is as silent as its success. Failure is reserved for
   what is wrong right now. */
const ok = (n, rows, hard = true) => {
  if (!rows.length) { pass++; console.log('PASS ' + n); return; }
  if (hard) { fail++; console.log('FAIL ' + n + ' -> ' + rows.slice(0, 6).join(' | ')); }
  else { pass++; console.log('PASS ' + n + ' (note: ' + rows.length + ') -> ' + rows.slice(0, 6).join(' | ')); }
};

/* Keys may be written several to a line, so do not anchor on line start
   alone — and the counted nouns are ARRAYS (`plResult: ['نتيجة', …]`),
   which a string-only pattern silently misses and then reports as six
   undefined keys. */
const KEY = /(?:^\s*|[{,]\s*)([A-Za-z][A-Za-z0-9_]*)\s*:\s*(?:['"`]|\[)/gm;

/* The two packs have to be BOUNDED, not merely split. Everything after
   them is ordinary code, and one comment down there reads
   «{ar:'..', en:'..'}» — which a split-at-`en:` read as an `ar` key
   belonging to the English pack. */
const packOf = (name) => {
  const i = i18n.indexOf('\n  ' + name + ': {');
  if (i < 0) return '';
  const end = i18n.indexOf('\n  },', i);
  return i18n.slice(i, end < 0 ? i18n.length : end);
};
const arPack = packOf('ar'), enPack = packOf('en');
const defined = new Set([...(arPack + enPack).matchAll(KEY)].map(m => m[1]));

const missing = [];
for (const f of files)
  for (const m of src[f].matchAll(/\bt\(\s*'([A-Za-z][A-Za-z0-9_]*)'\s*\)/g))
    if (!defined.has(m[1])) missing.push(at(f, m.index) + " t('" + m[1] + "')");
ok('1 every t() key is defined', missing);

const keysOf = s => new Set([...s.matchAll(KEY)].map(m => m[1]));
const A = keysOf(arPack), E = keysOf(enPack);
ok('2 no key in the Arabic pack alone', [...A].filter(k => !E.has(k)));
ok('3 no key in the English pack alone', [...E].filter(k => !A.has(k)));

const icons = new Set([...read('js/icons.js').matchAll(/^\s{2}([a-zA-Z0-9]+):/gm)].map(m => m[1]));
const badIcon = [];
for (const f of files)
  for (const m of src[f].matchAll(/\bicon\(\s*'([a-zA-Z0-9]+)'/g))
    if (!icons.has(m[1])) badIcon.push(at(f, m.index) + " icon('" + m[1] + "')");
ok('4 every icon asked for exists', badIcon);

/* exported and called by nobody: not a broken feature, but the same rule
   written twice — and the second copy is the one that gets forgotten */
const dead = [];
for (const f of files)
  for (const m of src[f].matchAll(/export (?:async )?function ([A-Za-z0-9_]+)/g)) {
    const name = m[1];
    const elsewhere = files.filter(g => g !== f).map(g => src[g]).join('\n');
    const here = (src[f].match(new RegExp('\\b' + name + '\\b', 'g')) || []).length > 1;
    if (!new RegExp('\\b' + name + '\\b').test(elsewhere) && !here) dead.push(at(f, m.index) + ' ' + name);
  }
ok('5 no exported function is dead', dead, false);

/* ⚠️ AND THE PRIVATE ONES. The loop above matches `export function` only,
   so a module-private function nobody calls is invisible to it — measured:
   `lockedBlock` in screens/directory.js, which builds the free-plan card
   and has no caller anywhere.

   The reach is wider than one function. `168` says at its own head that its
   list is «not written, but computed at run time from wiring.mjs» — so a
   blind spot here is a blind spot there, and `168` is the last file sent
   and the one whose whole job is the clearing up. A tool guards what it
   can see; what it cannot see it certifies clean.

   ⚠️ A note, not a failure, exactly like check 5 — and raising it to a
   failure happens in `168` alone, under the two conditions written there.
   A check that is red every morning is read as though it were switched off.
   ⚠️ AND NOTHING IS DELETED HERE: the tool finds, `168` removes. */
const deadLocal = [];
for (const f of files)
  for (const m of src[f].matchAll(/^(?!export)\s*(?:async )?function ([A-Za-z0-9_]+)/gm)) {
    const name = m[1];
    const uses = (src[f].match(new RegExp('\\b' + name + '\\b', 'g')) || []).length;
    if (uses <= 1) deadLocal.push(at(f, m.index) + ' ' + name);
  }
ok('5b no module-private function is dead', deadLocal, false);

const todo = [];
for (const f of files)
  for (const m of src[f].matchAll(/\/\/\s*(TODO|FIXME|HACK|XXX)\b.{0,60}/g))
    todo.push(at(f, m.index) + ' ' + m[0].trim());
ok('6 no TODO left behind', todo, false);

/* The data the built features are waiting for.

   ⚠️ THE RECORD IS READ, NOT THE TEXT. Matching `lat:` across the whole
   file counts the ZIP centres and the city points as listings and prints
   «34 of 514» — and that is the very sentence `docs/الحالة.md` carried
   until V.06.4 corrected it by measuring. The document was fixed and the
   tool was not, and the tool is what gets read first, every morning.

   The lesson is written at the head of this same file: keys are written
   several to a line, so a pattern over the text is a guess. THE TEXT IS
   READ BY PATTERNS AND ERRS; THE MODULE IS IMPORTED AND IS TRUE.

   ⚠️ `js/data.js` imports nothing and calls no network, so importing it
   in a static tool with no browser is safe. And `pathToFileURL` is not
   decoration: `R` comes from `process.argv[2]` and may be relative, and
   `import()` of a bare disk path fails on some platforms. */
const { BUSINESSES } = await import(pathToFileURL(path.join(R, 'js/data.js')).href);
const biz = BUSINESSES.length;
const geo = BUSINESSES.filter(b => b.lat != null && b.lng != null).length;
console.log(`\nDATA listings=${biz} withCoords=${geo}`);
ok('7 every listing has coordinates',
   geo >= biz ? [] : [`${geo} of ${biz} carry lat/lng — the ${biz - geo} others wait on the data job`],
   false);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
