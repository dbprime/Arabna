/* Generates docs/AI-PROVENANCE.md from `git log` — the provenance record the
   legal memo asked for (round two, item 5): date · spec · session · tests ·
   commit · human acceptance, per AI session.

   ⚠️ IT IS GENERATED, NEVER WRITTEN. A record kept by hand ages; one read
   off the repository at every close is true at every close. Nothing enters
   the table that is not read from `git` or from docs/الطابور.md, and a cell
   with no source stays «—».

   ⚠️ NO PERSON IS NAMED. git's Author column does not enter the table; the
   founder appears only by role, as `owner`.

   No dependencies: node:child_process and node:fs only.
     node tools/audit/provenance.mjs        (from the repository root) */
import { execSync } from 'node:child_process';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';

const sh = (c) => execSync(c, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
/* ⚠️ THE PUBLISHED main, not the clone's. A fresh clone can carry a local
   `main` parked on an old commit (measured: 104 rows on 9a98c8f against 191
   on the server), and a record generated from it would be a record of the
   wrong repository. `origin/main` is what is served; `main` is the fallback
   only when there is no remote at all. */
const ref = (() => {
  if (process.env.PROV_REF) return process.env.PROV_REF;   // the teeth run points it at a throwaway commit
  try { sh('git rev-parse --verify -q origin/main'); return 'origin/main'; } catch { /* no remote */ }
  return 'main';
})();

/* one record per commit, fenced with unit/record separators so a multi-line
   body cannot bleed into the next record */
const SEP = '\x1f', END = '\x1e';
const raw = sh(`git log ${ref} --date=short --format=%H%x1f%h%x1f%ad%x1f%s%x1f%b%x1e`);
const commits = raw.split(END).map(s => s.replace(/^\n+/, '')).filter(Boolean).map((r) => {
  const [hash, short, date, subject, body = ''] = r.split(SEP);
  return { hash, short, date, subject, body };
});

/* the owner's acceptance: [x] NNN in the queue */
const queuePath = 'docs/الطابور.md';
const accepted = new Set();
if (existsSync(queuePath)) {
  for (const m of readFileSync(queuePath, 'utf8').matchAll(/^\[x\]\s+(\d{3})\b/gm)) accepted.add(m[1]);
}

/* the batch number: three digits in brackets, after «إغلاق», after «docs:»,
   or at the head of the subject — the shapes the history actually has */
const batchOf = (s) => {
  const m = /\((\d{3})\)\s*$/.exec(s) || /^إغلاق\s+(\d{3})\b/.exec(s) || /^docs:\s*(\d{3})\b/.exec(s)
    || /^(\d{3})\s+[—-]/.exec(s) || /^(\d{3})\b/.exec(s);
  return m ? m[1] : '';
};
/* ⚠️ `\s`, never `\b`, after an Arabic word: JS's \b is ASCII-only and sits
   nowhere between ق and a space — `^إغلاق\b` matched nothing. */
const kindOf = (s) => (/^إغلاق\s/.test(s) || /^docs:\s*\d{3}\s*—\s*الشبكة/.test(s)) ? 'إغلاق'
  : /\bV\.\d+\.\d+\b/.test(s) ? 'شغل' : 'وثائق';
const sessionOf = (b) => { const m = /Claude-Session:\s*(\S+)/.exec(b); return m ? m[1] : ''; };
const netOf = (s, b) => {
  const m = /([\d,]+)\s*تشغيلة\s*·\s*(\d+)\s*سويتاً\s*·\s*([\d,]+)\s*بنداً/.exec(s + '\n' + b);
  return m ? `${m[1]} · ${m[2]} · ${m[3]}` : '';
};
const specOf = (n) => {
  if (!n) return '';
  if (existsSync('إصلاحات')) {
    try { const f = sh(`ls إصلاحات | grep -m1 "^${n}"`).trim(); if (f) return `إصلاحات/${f}`; } catch { /* none */ }
  }
  return n;
};
const cell = (v) => (v && String(v).trim()) ? String(v).replace(/\|/g, '\\|') : '—';
const link = (u) => u ? `[جلسة](${u})` : '—';

const rows = commits.map((c) => {
  const n = batchOf(c.subject);
  return `| ${c.date} | ${cell(n)} | ${kindOf(c.subject)} | \`${c.short}\` | ${cell(specOf(n))} | ${link(sessionOf(c.body))} | ${cell(netOf(c.subject, c.body))} | ${n && accepted.has(n) ? 'owner ✓' : '—'} |`;
});

const head = sh(`git rev-parse --short ${ref}`).trim();
const today = new Date().toISOString().slice(0, 10);
const out = `# سجلُّ مصدر التطوير بالذكاء الاصطناعيّ — مولَّدٌ من المستودع

يُولَّد بـ \`tools/audit/provenance.mjs\` عند كلّ إغلاق. لا يُحرَّر بيد.
آخرُ توليد: ${today} · على \`${head}\` (${ref}) · ${commits.length} كومِتاً

كيف يُقرأ: كلُّ دفعةٍ تبدأ بملفّ مواصفةٍ يكتبه مالكُ البرنامج ويقرّره
(الاختيارُ والترتيبُ والقرارات)، تنفّذه جلسةُ ذكاءٍ اصطناعيّ (رابطُها في
العمود)، وتُقاس بشبكة فحصٍ كاملة، ويقبلها المالكُ في الطابور. الأعمدةُ
الخمسة هي الأدلّةُ الخمسة التي طلبتها المذكّرة القانونيّة.

لا اسمَ شخصٍ في هذا الملفّ: المؤسّس يظهر بصفته \`owner\`، وعمودُ المؤلّف في
git لا يدخل الجدول. والخانةُ التي لا مصدرَ لها تبقى «—».

| التاريخ | الرقم | النوع | الكومِت | المواصفة | الجلسة | الشبكة | قبولُ المالك |
|---|---|---|---|---|---|---|---|
${rows.join('\n')}
`;
writeFileSync('docs/AI-PROVENANCE.md', out);
const noNum = commits.filter(c => !batchOf(c.subject)).length;
console.log(`docs/AI-PROVENANCE.md: ${commits.length} rows on ${ref}@${head} · ${noNum} without a batch number · ${accepted.size} accepted in the queue`);
