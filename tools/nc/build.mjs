import fs from 'fs';
const ar = JSON.parse(fs.readFileSync(new URL('./nc-ar.json', import.meta.url),'utf8'));
const en = JSON.parse(fs.readFileSync(new URL('./nc-en.json', import.meta.url),'utf8'));

const META = [
  ['ssn',        'file',        'community',    ''],
  ['area',       'mapPin',      'realestate',   ''],
  ['rent',       'building',    'realestate',   ''],
  ['license',    'car',         'education',    ''],
  ['school',     'graduation',  'education',    ''],
  ['bank',       'banknote',    'finance',      ''],
  ['health',     'shield',      'doctors',      ''],
  ['doctor',     'stethoscope', 'doctors',      'arabicSpoken'],
  ['halal',      'bag',         'grocery',      'halalMeat'],
  ['utilities',  'bolt',        'homeservices', ''],
  ['car',        'key',         'auto',         ''],
  ['translation','languages',   'community',    ''],
  ['immigration','scale',       'lawyers',      ''],
  ['fraud',      'alert',       'finance',      ''],
  ['work',       'briefcase',   'finance',      ''],
  ['transit',    'truck',       'community',    ''],
  ['taxes',      'creditCard',  'finance',      ''],
];

/* ⚠️ THE «last reviewed» DATE IS READ, NEVER TYPED. The lawyer's notice at
   the head of the guide carries a review date, and a date written by hand in
   the source is a date that goes stale with nobody noticing. `{ncReviewed}`
   in either pack is replaced here with the date of the newest source-check
   report in docs/تقارير/ — the file that records when the links and the
   official pages were last read. */
const reviewed = (() => {
  const dir = new URL('../../docs/\u062a\u0642\u0627\u0631\u064a\u0631/', import.meta.url);
  const dates = fs.readdirSync(dir)
    .filter(n => /\u0645\u0635\u0627\u062f\u0631/.test(n))
    .map(n => (/^(\d{4}-\d{2}-\d{2})/.exec(n) || [])[1])
    .filter(Boolean).sort();
  if (!dates.length) { console.error('nc: no source-check report in docs — nothing to date the notice with'); process.exit(1); }
  return dates[dates.length - 1];
})();

const q = s => "'" + String(s).split('{ncReviewed}').join(reviewed).replace(/\\/g,'\\\\').replace(/'/g,"\\'").replace(/\n/g,'\\n') + "'";
const IND = '        ';

function blockLine(b){
  if (b.p)     return `['p', ${q(b.p)}]`;
  if (b.h)     return `['h', ${q(b.h)}]`;
  if (b.warn)  return `['warn', ${q(b.warn)}]`;
  if (b.alert) return `['alert', ${q(b.alert)}]`;
  if (b.do)    return `['do', ${q(b.do)}]`;
  if (b.tool)  return `['tool', ${q(b.tool)}, ${q(b.alt)}]`;
  if (b.ul)    return `['ul',\n${b.ul.map(x=>IND+'  '+q(x)).join(',\n')}]`;
  if (b.rows)  return `['rows',\n${b.rows.map(r=>IND+'  ['+q(r[0])+', '+q(r[1])+']').join(',\n')}]`;
  return null;                       // {ad} is dropped — the slot is not content
}

function pack(sec){
  const lines = sec.blocks.map(blockLine).filter(Boolean);
  return `t: ${q(sec.t)}, b: [\n` + lines.map(l=>IND+l).join(',\n') + `\n      ]`;
}

let out = '';
ar.forEach((a,i)=>{
  const e = en[i], [id, icon, cat, attrs] = META[i];
  out += `\n  { id: ${q(id)}, icon: ${q(icon)}, cat: ${q(cat)}` +
         (attrs ? `, attrs: ${q(attrs)}` : '') + `,\n` +
         `    ar: { ${pack(a)} },\n` +
         `    en: { ${pack(e)} } },\n`;
});
fs.writeFileSync(new URL('./nc-body.txt', import.meta.url), out);
console.log('body ' + out.length + ' bytes · ' + ar.length + ' sections');
