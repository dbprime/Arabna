/* THE INVENTORY — derived from the tree, never written by hand.

   ⚠️ WHY IT EXISTS, and it is not «one more document». the owner asked on
   10 September 2026: «every time I ask you for a check you come back with
   new problems — why does every check find something? why not check once,
   properly, and produce them all?»

   The answer is measured, and the fault is not the depth of any one check:
   THERE IS NO CLOSED LIST OF WHAT CAN BREAK. So every checking session
   invents its own axes, and the axes chosen decide what is found — and the
   word «thorough» with no inventory behind it means «as far as I looked
   this time», which is not a measurement.

   So the list is derived once, from the code, and each line carries the
   date it was last checked. After that a check is COUNTING and not
   judgement: what has not been checked shows itself and does not wait for
   anybody to remember it.

   ⚠️ AND NOT ONE LINE OF IT IS WRITTEN BY HAND. A hand-written list ages
   in the first batch — that is `615`'s lesson word for word: the suite
   list was a literal string, so a forgotten suite was never run while the
   net printed «complete».

   ⚠️ AND THE DATES ARE CARRIED, NOT REGENERATED. Regenerating the file
   whole would erase every check a human ever recorded; writing it by hand
   would let it age. It is derived AND carried, which is the whole
   property: the inventory cannot go stale because it is derived, and the
   human record cannot be lost because it is carried.

   ⚠️ AND THE KEY IS FILE + NAME, NEVER A LINE NUMBER. A line number moves
   with every batch, and a key that moves erases the check date on every
   edit — the thing this file exists to keep.

       node tools/audit/inventory.mjs .        writes docs/الجرد.md
       node tools/audit/inventory.mjs . --check   prints nothing, exits 1 on drift

   `?` in a cell means THE TOOL DOES NOT DECIDE THIS — a person does, and
   records the date. It is not a gap in the file; it is the file saying
   what is not known, which is what makes «how many are unchecked?» a
   question with a number.                                                */

import fs from 'fs';
import path from 'path';
import { pathToFileURL } from 'node:url';

const R = path.resolve(process.argv[2] || '.');
const CHECK = process.argv.includes('--check');
const OUT = path.join(R, 'docs/الجرد.md');

const read = p => fs.readFileSync(path.join(R, p), 'utf8');
const screens = fs.readdirSync(path.join(R, 'js/screens')).sort().map(f => 'js/screens/' + f);
const core = ['js/app.js', 'js/ui.js', 'js/store.js', 'js/data.js', 'js/icons.js',
  'js/feasts.js', 'js/prayer.js', 'js/holidays.js', 'js/synonyms.js', 'js/install.js'];
const jsFiles = [...core.filter(f => fs.existsSync(path.join(R, f))), ...screens];
const src = Object.fromEntries(jsFiles.map(f => [f, read(f)]));
const allJs = jsFiles.map(f => src[f]).join('\n');
const migDir = path.join(R, 'supabase/migrations');
const migs = fs.existsSync(migDir)
  ? fs.readdirSync(migDir).filter(f => f.endsWith('.sql')).sort()
  : [];
const sql = migs.map(f => fs.readFileSync(path.join(migDir, f), 'utf8')).join('\n');

/* ⚠️ Comments are stripped before any «does the code do X» reading. This
   project has paid for that four times: a check that matched the sentence
   EXPLAINING its own rule and reported the fault it exists to prevent. */
const nocmt = t => t.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:])\/\/.*$/gm, '$1');
const codeOf = Object.fromEntries(jsFiles.map(f => [f, nocmt(src[f])]));
const allCode = jsFiles.map(f => codeOf[f]).join('\n');
const sqlCode = nocmt(sql);

/** the nearest function name above an index — the caller, named honestly */
const FN = /(?:export\s+)?(?:async\s+)?function\s+([A-Za-z_$][\w$]*)|(?:const|let)\s+([A-Za-z_$][\w$]*)\s*=\s*(?:async\s*)?(?:\(|function)/g;
function enclosing(text, at) {
  let name = '—';
  FN.lastIndex = 0;
  let m;
  while ((m = FN.exec(text)) && m.index < at) name = m[1] || m[2] || name;
  return name;
}

const rows = {};                       // class -> [{key, cells}]
const add = (cls, key, cells) => (rows[cls] ||= []).push({ key, cells });

/* ---------------- 1) the screens: from ROUTES, not from a list -------- */
{
  const app = codeOf['js/app.js'];
  const block = app.slice(app.indexOf('const ALL_ROUTES = ['));
  const table = block.slice(0, block.indexOf('\n];'));
  for (const m of table.matchAll(/re:\s*(\/[^,]+\/)\s*,\s*screen:\s*([A-Za-z_$][\w$]*)/g)) {
    const [, re, screen] = m;
    const file = jsFiles.find(f => new RegExp('(export\\s+)?function\\s+' + screen + '\\b').test(codeOf[f])) || '?';
    add('screens', 'screen/' + screen + '/' + re, [pipe(re), screen, file]);
  }
}

/* ---------------- 2) the actions a reader can press ------------------- */
{
  for (const f of screens) {
    const c = codeOf[f];
    // every id bound to a click, and the first call its handler makes
    for (const m of c.matchAll(/\$\(\s*'#([\w-]+)'\s*\)\s*(?:\.[\w$]+)*\s*\.addEventListener\(\s*'click'/g)) {
      const body = c.slice(m.index, m.index + 900);
      const call = (body.match(/(?:S|await\s+S)\.([A-Za-z_$][\w$]*)\s*\(/) || [])[1]
        || (body.match(/\bgo\(\s*'([^']+)'/) || []).slice(1).map(x => 'go ' + x)[0]
        || '?';
      add('actions', 'action/' + f + '/#' + m[1], [f.replace('js/screens/', ''), '#' + m[1], call]);
    }
    // every data-* hook a template writes, which is how rows are wired
    const hooks = new Set();
    for (const m of c.matchAll(/\[data-([a-z][\w-]*)\]/g)) hooks.add(m[1]);
    for (const h of [...hooks].sort())
      add('actions', 'hook/' + f + '/' + h, [f.replace('js/screens/', ''), 'data-' + h, '?']);
  }
}

/* ---------------- 3) every write that leaves the device --------------- */
{
  for (const f of jsFiles) {
    const c = codeOf[f];
    for (const m of c.matchAll(/sb\s*\.\s*from\(\s*'([a-z_]+)'\s*\)\s*\.\s*(insert|update|upsert|delete)\b/g)) {
      const chain = c.slice(m.index, c.indexOf(';', m.index) + 1);
      const readsBack = /\.select\(/.test(chain) ? 'نعم' : 'لا';
      const fn = enclosing(c, m.index);
      add('writes', 'write/' + m[1] + '/' + m[2] + '/' + fn, [m[1], m[2], fn + '()', readsBack]);
    }
  }
}

/* ---------------- 4) the tables and their columns --------------------- */
{
  const tables = new Map();
  for (const m of sqlCode.matchAll(/create table (?:if not exists )?public\.([a-z_]+)\s*\(([\s\S]*?)\n\);/g)) {
    const cols = [];
    for (const line of m[2].split('\n')) {
      const c = line.match(/^\s{2,}([a-z_]+)\s+(?!table|key|check|unique|primary|foreign|constraint)[a-z]/);
      if (c) cols.push(c[1]);
    }
    tables.set(m[1], cols);
  }
  for (const m of sqlCode.matchAll(/alter table public\.([a-z_]+)\s+add column (?:if not exists )?([a-z_]+)/g))
    if (tables.has(m[1]) && !tables.get(m[1]).includes(m[2])) tables.get(m[1]).push(m[2]);

  const pol = new Map();               // table -> Set(op)
  for (const m of sqlCode.matchAll(/create policy\s+"[^"]*"\s+on public\.([a-z_]+)\s+for\s+([a-z]+)/g)) {
    if (!pol.has(m[1])) pol.set(m[1], new Set());
    pol.get(m[1]).add(m[2] === 'all' ? 'الكلّ' : m[2]);
  }
  for (const [tbl, cols] of [...tables].sort())
    for (const col of cols) {
      /* A column is «read» when its snake_case name appears in the app's
         own code at all — the maps are the only place it can. Nothing
         cleverer is claimed: this is a presence test, and a `?` would be
         less useful than a fact that is easy to check by hand. */
      const seen = new RegExp('\\b' + col + '\\b').test(allCode);
      add('columns', 'col/' + tbl + '/' + col,
        [tbl, col, seen ? 'نعم' : 'لا', [...(pol.get(tbl) || [])].sort().join(' · ') || 'لا شيء']);
    }
}

/* ---------------- 5) every promise the app makes out loud ------------- */
{
  for (const f of jsFiles) {
    const c = codeOf[f];
    for (const m of c.matchAll(/toast\(\s*t\(\s*'([A-Za-z][\w]*)'\s*\)\s*,\s*'ok'/g)) {
      const before = c.slice(Math.max(0, m.index - 700), m.index);
      const call = (before.match(/await\s+(?:S\.)?([A-Za-z_$][\w$]*)\s*\([^;]*\)[^;]*$/) || [])[1] || '—';
      add('promises', 'promise/' + f + '/' + m[1],
        [f.replace('js/screens/', '').replace('js/', ''), m[1], call === '—' ? '—' : call + '()', call === '—' ? 'لا نداء' : '?']);
    }
  }
}

/* ---------------- 6) every box a human fills -------------------------- */
{
  for (const f of screens) {
    const c = src[f];                  // the markup lives in template strings
    for (const m of c.matchAll(/<(input|select|textarea)\b[^>]*\bid="([\w-]+)"/g))
      add('fields', 'field/' + f + '/' + m[2], [f.replace('js/screens/', ''), m[1], '#' + m[2], '?']);
  }
}

/* ---------------- 7) every path money travels ------------------------- */
{
  const d = codeOf['js/data.js'];
  for (const m of d.matchAll(/export const ([A-Z][A-Z0-9_]*)\s*=/g)) {
    const start = m.index;
    const chunk = d.slice(start, start + 2600);
    if (!/\b(price|prices|week1|month1|monthly|yearly|PRICE)\b/.test(chunk.split('\nexport ')[0])
        && !/PRICE/.test(m[1])) continue;
    const readers = jsFiles
      .filter(f => f !== 'js/data.js' && new RegExp('\\b' + m[1] + '\\b').test(codeOf[f]))
      .map(f => f.replace('js/screens/', '').replace('js/', ''));
    add('money', 'money/' + m[1], [m[1], String(readers.length), readers.slice(0, 4).join(' · ') || 'لا قارئ']);
  }
}

/* ---------------- 8) the religious times ------------------------------ */
{
  for (const f of ['js/prayer.js', 'js/feasts.js', 'js/holidays.js']) {
    if (!src[f]) continue;
    for (const m of codeOf[f].matchAll(/export (?:async )?function ([A-Za-z_$][\w$]*)/g)) {
      const readers = jsFiles
        .filter(x => x !== f && new RegExp('\\b' + m[1] + '\\b').test(codeOf[x]))
        .map(x => x.replace('js/screens/', '').replace('js/', ''));
      add('worship', 'worship/' + f + '/' + m[1],
        [f.replace('js/', ''), m[1] + '()', readers.slice(0, 4).join(' · ') || 'لا قارئ']);
    }
  }
}

function pipe(s) { return String(s).replace(/\|/g, '\\|'); }

/* ---------------- the dates are CARRIED, never regenerated ------------ */
const prior = new Map();
if (fs.existsSync(OUT))
  for (const line of fs.readFileSync(OUT, 'utf8').split('\n')) {
    const m = line.match(/^\|\s*`([^`]+)`\s*\|.*\|\s*([0-9]{4}-[0-9]{2}-[0-9]{2}|—)\s*\|\s*$/);
    if (m && m[2] !== '—') prior.set(m[1], m[2]);
  }

const CLASSES = [
  ['screens',  '١) الشاشات',            ['المسار', 'الدالّة', 'الملفّ']],
  ['actions',  '٢) الأفعال',            ['الشاشة', 'الزرّ', 'ينادي']],
  ['writes',   '٣) الكتابات إلى الخادم', ['الجدول', 'العمليّة', 'المنادِية', 'تُقرأ الإجابة']],
  ['columns',  '٤) الجداول والأعمدة',   ['الجدول', 'العمود', 'مذكور في js/', 'سياسات']],
  ['promises', '٥) الوعود',             ['الملفّ', 'الجملة', 'فوقها', 'تُقرأ إجابته']],
  ['fields',   '٦) الخانات',            ['الشاشة', 'النوع', 'المعرّف', 'يصل عموداً']],
  ['money',    '٧) مسارات المال',        ['الثابت', 'عدد القرّاء', 'من يقرؤها']],
  ['worship',  '٨) الأوقات الدينيّة',    ['الملفّ', 'الدالّة', 'الشاشات']],
];

let total = 0, dated = 0;
const body = [];
for (const [cls, title, head] of CLASSES) {
  const list = (rows[cls] || []).sort((a, b) => a.key < b.key ? -1 : a.key > b.key ? 1 : 0);
  const seen = new Set();
  const uniq = list.filter(r => !seen.has(r.key) && seen.add(r.key));
  const withDate = uniq.filter(r => prior.has(r.key)).length;
  total += uniq.length; dated += withDate;
  body.push(`## ${title} — ${uniq.length} بنداً · ${withDate} مفحوصاً · ${uniq.length - withDate} بلا فحص\n`);
  body.push('| المفتاح | ' + head.join(' | ') + ' | آخر فحص |');
  body.push('|' + '---|'.repeat(head.length + 2));
  for (const r of uniq)
    body.push('| `' + r.key + '` | ' + r.cells.map(pipe).join(' | ') + ' | ' + (prior.get(r.key) || '—') + ' |');
  body.push('');
}

const HEAD = `# جردُ عربنا — ما يمكن أن ينكسر

⚠️ **هذا الملفّ مولَّد. لا يُكتَب بيدٍ، ولا يُحرَّر إلّا في عمودٍ واحد.**
يُعاد توليدُه بـ\`node tools/audit/inventory.mjs .\`، و\`wiring.mjs\` تُحمِّر
إن تخلّف عن الشجرة.

⚠️ **العمودُ الوحيدُ الذي يكتبه إنسان هو «آخر فحص».** يُكتَب فيه تاريخُ
اليوم الذي فُحص فيه البند فعلاً بصيغة \`YYYY-MM-DD\`، **ويُحمَل عبر كلّ
إعادةِ توليد** ما دام مفتاحُ البند قائماً. **و«—» تعني: لم يُفحَص قطّ.**

⚠️ **و«?» في خليّةٍ مشتقّةٍ تعني أنّ الأداةَ لا تحكم في هذا** — يحكم فيه
إنسانٌ ويكتب تاريخَه. **وهو ليس نقصاً في الملفّ بل مُخرَجُه**: أوّلُ مرّةٍ
يصير فيها سؤالُ «كم بنداً لم يُفحَص؟» سؤالاً له رقم.

⚠️ **والمفتاحُ من الملفّ والاسم لا من رقم السطر** — رقمُ السطر يتحرّك بكلّ
دفعة، ومفتاحٌ يتحرّك يمحو تاريخَ الفحص عند كلّ تعديل.

**والأعدادُ تحت تُقرأ من الجداول ولا تُكتَب بيد** — قاعدةُ \`615\`.

`;

const SUM = `## المجموع

\`\`\`
البنود        ${total}
مفحوصة        ${dated}
بلا فحص       ${total - dated}
\`\`\`

`;

const text = HEAD + SUM + body.join('\n').replace(/\n+$/, '') + '\n';

if (CHECK) {
  const cur = fs.existsSync(OUT) ? fs.readFileSync(OUT, 'utf8') : '';
  if (cur !== text) { console.log('DRIFT'); process.exit(1); }
  process.exit(0);
}
fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, text);
console.log(`docs/الجرد.md: ${total} بنداً · ${dated} مفحوصاً · ${total - dated} بلا فحص`);
for (const [cls, title] of CLASSES) console.log('  ' + title + ': ' + (rows[cls] || []).length);
