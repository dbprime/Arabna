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

const q = s => "'" + String(s).replace(/\\/g,'\\\\').replace(/'/g,"\\'").replace(/\n/g,'\\n') + "'";
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
