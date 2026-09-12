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
/* ⚠️ GUARD A — FETCH BEFORE READING. The remote-tracking ref in a container
   can itself be stale (measured: `origin/main` parked on 9a98c8f while the
   server held 196 commits), and a record generated from it went BACK 89
   rows. So `main` is fetched from the server first; if there is no network
   the header says «(بلا fetch)» so nobody reads a stale record as a fresh one. */
let fetched = true;
try { sh('git fetch origin +refs/heads/main:refs/remotes/origin/main --force 2>/dev/null'); }
catch { fetched = false; console.error('provenance: git fetch failed — generating from HEAD without it (بلا fetch)'); }
/* ⚠️ THE REF IS HEAD, NOT origin/main. Generated from `origin/main` at a
   close, the record could never hold the batch being closed — its commits
   sit on the branch and are not on the server yet — so the file came out
   identical to the previous one and the record on main ran a whole batch
   behind, always (measured: faf99fc · bc64acc · 2f512da · f4d9055 all absent).
   HEAD holds the branch; guard D below makes sure it also holds the server. */
const ref = process.env.PROV_REF || 'HEAD';   // the teeth run points it at a throwaway commit
/* ⚠️ GUARD D — HEAD MUST CONTAIN origin/main. A branch behind the server
   would generate a record missing what is already published. Checked only
   when the fetch succeeded: a stale local ref proves nothing either way. */
if (fetched && !process.env.PROV_REF) {
  let hasRemote = true;
  try { sh('git rev-parse --verify -q origin/main'); } catch { hasRemote = false; }
  if (hasRemote) {
    try { sh('git merge-base --is-ancestor origin/main HEAD'); }
    catch {
      console.error('HEAD لا يحوي origin/main — الفرعُ خلف الخادم. اسحب أوّلاً.');
      process.exit(1);
    }
  }
}

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
const statePath = 'docs/الحالة.md';
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
const NET_RE = /([\d,]+)\s*تشغيلة\s*·\s*(\d+)\s*سويتاً\s*·\s*([\d,]+)\s*بنداً/;
const netOf = (s, b) => {
  const m = NET_RE.exec(s + '\n' + b);
  return m ? `${m[1]} · ${m[2]} · ${m[3]}` : '';
};

/* ⚠️ A BACK-FILL, and only for a commit whose OWN message cannot carry the
   figures. `685` merged with no closing commit, so `58c16db` reached `main`
   with an English message and an empty net cell — and a merged message is
   not rewritten, while this file is GENERATED and never hand-edited
   (rule 9). So the tool reads the figures from the one place a human wrote
   them, `docs/الحالة.md`, exactly as it already reads the owner's
   acceptance out of `docs/الطابور.md`: ONE source, two readers.
   ⚠️ THE COMMIT'S OWN MESSAGE ALWAYS WINS — a back-fill can never overwrite
   a measured figure, only fill an empty cell. */
const backfill = new Map();
if (existsSync(statePath)) {
  const re = /شبكةٌ مُستدرَكة\s*—\s*`([0-9a-f]{7,40})`\s*=\s*([\d,]+)\s*تشغيلة\s*·\s*(\d+)\s*سويتاً\s*·\s*([\d,]+)\s*بنداً/g;
  for (const m of readFileSync(statePath, 'utf8').matchAll(re)) {
    backfill.set(m[1], `${m[2]} · ${m[3]} · ${m[4]}`);
  }
}
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
  return `| ${c.date} | ${cell(n)} | ${kindOf(c.subject)} | \`${c.short}\` | ${cell(specOf(n))} | ${link(sessionOf(c.body))} | ${cell(netOf(c.subject, c.body) || backfill.get(c.short) || '')} | ${n && accepted.has(n) ? 'owner ✓' : '—'} |`;
});

/* ⚠️ GUARD C — A BACK-FILL THAT LANDS NOWHERE IS DEBT THAT READS AS A
   RECORD. An entry naming a commit the log does not hold, or one whose own
   message already carries its figures, fills no cell and says so to nobody.
   Both are refused loudly rather than ignored quietly. */
if (backfill.size) {
  const byShort = new Map(commits.map((c) => [c.short, c]));
  const bad = [];
  for (const [short, fig] of backfill) {
    const c = byShort.get(short);
    if (!c) { bad.push(`${short}: ليس في السجلّ`); continue; }
    if (netOf(c.subject, c.body)) bad.push(`${short}: رسالتُه تحمل أرقامَها، فالاستدراكُ ميّت`);
    void fig;
  }
  if (bad.length) {
    console.error(`استدراكُ شبكةٍ لا يقع في خانة:\n  ${bad.join('\n  ')}`);
    process.exit(1);
  }
}

const head = sh(`git rev-parse --short ${ref}`).trim();
const lastDate = sh(`git log -1 --format=%ad --date=short ${ref}`).trim();
const today = new Date().toISOString().slice(0, 10);
/* ⚠️ GUARD B — A PROVENANCE RECORD NEVER SHRINKS except by rewriting
   history. If the new count is below what the file already holds, the ref
   is stale: refuse, exit 1, and say what to do. */
const OUT = 'docs/AI-PROVENANCE.md';
if (existsSync(OUT)) {
  const have = (readFileSync(OUT, 'utf8').match(/^\| 20\d\d-/gm) || []).length;
  if (commits.length < have) {
    console.error(`السجلّ يتراجع من ${have} إلى ${commits.length} — المرجع عالق. شغّل git fetch ثمّ أعِد.`);
    process.exit(1);
  }
}
const out = `# سجلُّ مصدر التطوير بالذكاء الاصطناعيّ — مولَّدٌ من المستودع

يُولَّد بـ \`tools/audit/provenance.mjs\` عند كلّ إغلاق. لا يُحرَّر بيد.
آخرُ توليد: ${today} · على \`${head}\` (${ref}${fetched ? '' : ' · بلا fetch'}) · آخرُ كومِتٍ فيه ${lastDate} · ${commits.length} كومِتاً
كومِتُ الإغلاق الأخير يدخل السجلَّ في الإغلاق الذي يليه.

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
writeFileSync(OUT, out);
const noNum = commits.filter(c => !batchOf(c.subject)).length;
console.log(`docs/AI-PROVENANCE.md: ${commits.length} rows on ${ref}@${head} · ${noNum} without a batch number · ${accepted.size} accepted in the queue`);
