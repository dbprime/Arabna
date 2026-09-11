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
import { spawnSync } from 'node:child_process';

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

/* 8 — THE INVENTORY IS NOT ALLOWED TO FALL BEHIND THE TREE.

   ⚠️ Its whole value is that it is DERIVED, so a new screen, a new write
   or a new column cannot land without appearing in it. Without this line
   the file becomes one more document that ages — which is the thing it
   was built to replace, and `615`'s own lesson: a list nothing compares
   against is a list that lies.

   ⚠️ AND ITS PLACE IS THE STATIC PASS, NOT A BROWSER SUITE — `376` §5:
   guarding a written rule belongs where nothing has to be rendered to
   read it. It runs in a second and it runs on every gate.

   The tool re-derives and compares; `--check` exits 1 on any difference
   other than the dates, which it carries. */
const invOut = path.join(R, 'docs/الجرد.md');
if (!fs.existsSync(invOut)) {
  ok('8 the inventory is generated and current', ['docs/الجرد.md is missing — run tools/audit/inventory.mjs']);
} else {
  const r = spawnSync(process.execPath, [path.join(R, 'tools/audit/inventory.mjs'), R, '--check'],
    { encoding: 'utf8' });
  ok('8 the inventory is generated and current',
     r.status === 0 ? []
     : ['docs/الجرد.md is behind the tree — run `node tools/audit/inventory.mjs .` and commit it']);
  const txt = fs.readFileSync(invOut, 'utf8');
  const total = (txt.match(/^\| `/gm) || []).length;
  const dated = (txt.match(/\| [0-9]{4}-[0-9]{2}-[0-9]{2} \|$/gm) || []).length;
  console.log(`\nINVENTORY items=${total} checked=${dated} unchecked=${total - dated}`);
  /* A NOTE and never a failure, the same as 5, 6 and 7 above: an unchecked
     item is work waiting, not a fault standing. A check that is red every
     morning on something known is read as though it were switched off. */
  ok('8b every inventory item has been checked at least once',
     total === dated ? [] : [`${total - dated} of ${total} carry no check date`], false);
}

/* 9 — 660: EVERY PICTURE PICKER SAYS ITS SIZE, AND THE ROW CARRIES ITS PATH.

   ⚠️ THE COUNT IS DERIVED FROM THE SOURCE AND NOT WRITTEN HERE. That is
   the whole guard: a sixth picker added in a month drops the net until it
   is given a size, and nothing else would have said it was forgotten.

   ⚠️ AND IT IS ASKED IN BOTH DIRECTIONS — a `sizeKey` with no entry in the
   packs prints nothing under the box, and an entry nobody passes is debt
   that reads as approved copy. */
const pickerFiles = ['js/screens/marketplace.js', 'js/screens/directory.js',
                     'js/screens/profile.js', 'js/screens/events.js', 'js/screens/advertise.js'];
const calls = [];
for (const f of pickerFiles) {
  const txt = read(f);
  /* ⚠️ the DEFINITION is not a call, and a matcher that cannot tell them
     apart reports the one place that has nothing to pass */
  for (const m of txt.matchAll(/(?<!function\s)mountPhotoPicker\s*\(/g)) {
    /* the call's own arguments, balanced — a regex to the closing bracket
       would stop at the first `)` inside a nested call */
    let i = m.index + m[0].length, depth = 1;
    while (i < txt.length && depth > 0) {
      if (txt[i] === '(') depth++;
      else if (txt[i] === ')') depth--;
      i++;
    }
    const args = txt.slice(m.index + m[0].length, i - 1);
    const key = /sizeKey\s*:\s*'([A-Za-z0-9_]+)'/.exec(args);
    calls.push({ file: f, line: txt.slice(0, m.index).split('\n').length, key: key ? key[1] : null });
  }
}
ok('9.1 every mountPhotoPicker call passes a sizeKey',
   calls.filter(c => !c.key).map(c => `${c.file}:${c.line} has none`));
const passed = new Set(calls.map(c => c.key).filter(Boolean));
ok('9.2 …and every sizeKey passed is defined in BOTH packs',
   [...passed].filter(k => !(A.has(k) && E.has(k))).map(k => k + ' is not in both packs'));
ok('9.3 …and no size string is defined that nobody passes',
   [...A].filter(k => /^size[A-Z]/.test(k) && !passed.has(k)).map(k => k + ' is defined and never used'));

/* ⚠️ AND THE FIELD WHOSE ABSENCE WAS THE FAULT. `eventRowFrom` built the
   row out of nineteen fields and carried no picture at all, so the form
   collected one, the row reached the server without it, and the picture
   sat in `state.eventEdits` on one phone. */
ok('9.4 the event row carries its picture’s path',
   /photo_path:/.test(src['js/store.js'].slice(
     src['js/store.js'].indexOf('function eventRowFrom'),
     src['js/store.js'].indexOf('function eventRowFrom') + 2400)) ? [] : ['eventRowFrom writes no photo_path']);

/* ⚠️ AND THE CSP HOST IS THE ONE THING THAT MAKES ANY OF IT VISIBLE. With
   `img-src 'self' data: blob:` the whole batch lands green and not one
   picture appears: the browser refuses a signed link as a POLICY refusal,
   with no failed request and no 404 — and `660`'s own designed cover makes
   that absence look BETTER than it did, so the failure is harder to see,
   not easier. The two files are identical today and part company at the
   first edit to one of them. */
/* ⚠️ THE WHOLE POLICY AND NOT UP TO THE FIRST QUOTE. The policy contains
   `'self'`, so a pattern stopping at a quote reads two words of it and
   compares one truncation with another — the trap `610`'s own suite fell
   into and measured nothing at all. */
const cspOf = (txt) => {
  const m = /default-src [^;]*;[^"]*?(?=["']\s*[\/}])/.exec(txt);
  return m ? m[0].trim() : '';
};
const cspHtml = cspOf(read('index.html'));
const cspJson = cspOf(read('vercel.json'));
ok('9.5 the two content-security policies are identical, letter for letter',
   cspHtml && cspHtml === cspJson ? [] : ['index.html and vercel.json disagree']);
const imgSrc = /img-src ([^;]*)/.exec(cspHtml);
ok('9.6 …and img-src admits the file store, or no picture is ever drawn',
   imgSrc && /supabase\.co/.test(imgSrc[1]) ? [] : ['img-src does not admit the storage host']);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
