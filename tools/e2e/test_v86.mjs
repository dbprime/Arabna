/* 652 — the migration runs itself at merge.

   ⚠️ THE FAULT THIS CLOSES IS MEASURED, NOT FEARED. `docs/الحالة.md` §1.ج
   records that of the first seven migrations TWO had silently never run —
   `0005` answered «Could not find the function public.admin_find_users»
   and `0004` measured `tier2_by = 0` rows in information_schema.columns —
   and nobody could have known, because there was no record on the server
   of what had run. The repository and the database could disagree for
   weeks with no signal anywhere.

   ⚠️ AND THE COVERAGE IS STRUCTURAL BY DECISION, not for want of effort.
   A browser net cannot reach a GitHub workflow, and the runner's own
   behaviour — a rolled-back failure, a second run that does nothing, an
   unreachable server that is announced rather than read as an answer —
   was measured against a REAL PostgreSQL cluster while this batch was
   written, and the figures are in `CLAUDE.md`. What lives here is what
   must not rot afterwards.

   ⚠️ COMMENTS ARE STRIPPED BEFORE ANY «does the code do X» QUESTION. The
   runner's own header has to say «NO `set -x` ANYWHERE IN THIS FILE» in
   order to explain itself, and the ledger migration's header has to name
   the two characters the SQL editor drops. A check that read the prose
   would report the fault it exists to prevent — this project has paid for
   that four times (v53, v55, v649, v84). */
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { execSync } from 'node:child_process';

/* ⚠️ never a relative path — run.sh runs from its own working directory. */
const ROOT = new URL('../../', import.meta.url).pathname;
let pass = 0, fail = 0;
const ok = (n, c, extra = '') => { if (c) { pass++; console.log('PASS ' + n + (extra ? ' -> ' + extra : '')); }
  else { fail++; console.log('FAIL ' + n + (extra ? ' -> ' + extra : '')); } };

const read = f => readFileSync(ROOT + f, 'utf8');
const shCode  = s => s.split('\n').filter(l => !/^\s*#/.test(l)).join('\n');
const sqlCode = s => s.split('\n').filter(l => !/^\s*--/.test(l)).join('\n');
const ymlCode = s => s.split('\n').filter(l => !/^\s*#/.test(l)).join('\n');

const MIG   = ROOT + 'supabase/migrations/';
const files = readdirSync(MIG).filter(f => /^\d{4}_[a-z0-9_]+\.sql$/.test(f)).sort();
const LEDGER = '0012_migration_ledger.sql';

const RUN = 'tools/migrate.sh';
const WF  = '.github/workflows/migrations.yml';

/* ============================================================
   1 — the runner exists, and is one script called by both doors
   ============================================================ */
console.log('--- 1: one runner, not the same rule written twice ---');
{
  ok('1.1 the runner is a file in the repository', existsSync(ROOT + RUN));
  ok('1.2 the workflow exists', existsSync(ROOT + WF));
  const wf = ymlCode(read(WF));
  /* ⚠️ BOTH doors call the SAME script. Two YAML blocks each carrying the
     logic is the `esc()` fault: two versions, two batches later, and the
     one nobody edits is the one that runs on production. */
  const calls = (wf.match(/bash tools\/migrate\.sh/g) || []).length;
  ok('1.3 both doors call the one script, and neither carries the logic itself',
     calls === 2 && !/psql/.test(wf), calls + ' calls · psql in the yaml: ' + /psql/.test(wf));
}

/* ============================================================
   2 — display on the pull request, execution on `main` and nowhere else
   ============================================================ */
console.log('--- 2: never from a branch ---');
{
  const wf = ymlCode(read(WF));
  ok('2.1 the push trigger is filtered to main at the trigger itself',
     /push:\s*\n\s*branches:\s*\[\s*main\s*\]/.test(wf));
  /* ⚠️ GUARDED TWICE ON PURPOSE. A branch that could execute means
     everyone who pushes a branch writes on the production database —
     «main is production» unpicked from behind. Either guard alone would
     do; neither alone is what this is worth. */
  ok('2.2 …and again on the job that applies',
     /if:\s*github\.event_name == 'push' && github\.ref == 'refs\/heads\/main'/.test(wf));
  ok('2.3 the pull request job runs on a pull request and only there',
     /if:\s*github\.event_name == 'pull_request'/.test(wf));
  /* the show door must never be able to write, whatever it is handed */
  ok('2.4 the pull request door asks for `comment`, never `apply`',
     /migrate\.sh comment/.test(wf) && !/pull_request[\s\S]{0,400}migrate\.sh apply/.test(wf));
  ok('2.5 and the main door asks for `apply`', /migrate\.sh apply/.test(wf));

  const sh = shCode(read(RUN));
  ok('2.6 `list` and `comment` never write — no apply_one on that path',
     /list\|comment\)([\s\S]*?);;/.test(sh) &&
     !/apply_one/.test((/list\|comment\)([\s\S]*?);;/.exec(sh) || ['', ''])[1]));
}

/* ============================================================
   3 — the ledger is seeded by an explicit list, never derived
   ============================================================
   ⚠️ THIS IS THE ITEM THAT PREVENTS A MIGRATION BEING SKIPPED IN SILENCE,
   and a silent skip is worse than a forgotten migration: a forgotten one
   is still waiting, a skipped one is closed for ever. A seed built at run
   time from whatever the folder happens to hold would mark a file
   «executed» that has never been executed. */
console.log('--- 3: the seed is typed out, and it matches the state file ---');
{
  ok('3.1 the ledger migration exists', files.includes(LEDGER));
  const sql = sqlCode(read('supabase/migrations/' + LEDGER));
  const ins = /insert into public\.migration_log[\s\S]*?on conflict/.exec(sql);
  ok('3.2 it seeds with a literal list of file names, not a query over the folder',
     !!ins && !/select[\s\S]*?from\s+(pg_|information_schema)/i.test(ins[0]),
     ins ? 'literal' : 'no insert found');
  const seeded = [...(ins ? ins[0] : '').matchAll(/'(\d{4}_[a-z0-9_]+\.sql)'/g)].map(m => m[1]).sort();
  ok('3.3 …and every seeded name is a file that really exists',
     seeded.every(f => files.includes(f)), seeded.filter(f => !files.includes(f)).join(', ') || seeded.length + ' names');

  /* ⚠️ THE TWO-WAY AGREEMENT, and it is what keeps the seed honest.
     `docs/الحالة.md` §1.ج is the project's own record of what ran by hand
     before this runner existed. A row marked ✓ there and not seeded here
     would be re-run needlessly; a name seeded here that the record does
     NOT mark as executed would be closed for ever without ever running.
     Both halves are red. */
  const doc = read('docs/الحالة.md');
  const sec = /## 1\.ج\)[\s\S]*?\n## /.exec(doc);
  const rows = [...(sec ? sec[0] : '').matchAll(/^\|\s*`(\d{4}_[a-z0-9_]+\.sql)`\s*\|[^|]*\|([^\n]*)\|/gm)];
  ok('3.4 the state file records a row for every migration file',
     files.every(f => rows.some(r => r[1] === f)),
     files.filter(f => !rows.some(r => r[1] === f)).join(', ') || rows.length + ' rows');
  /* run by hand = marked done, and not marked as the runner's work */
  const byHand = rows.filter(r => /✓/.test(r[2]) && !/بالمُشغِّل/.test(r[2])).map(r => r[1]).sort();
  ok('3.5 the seed is exactly what the state file marks as run BY HAND',
     seeded.join(',') === byHand.join(','),
     'seeded [' + seeded.join(' ') + '] · by hand [' + byHand.join(' ') + ']');
  /* ⚠️ and nothing still outstanding is seeded — that is the silent skip */
  const pendingRows = rows.filter(r => /⏳/.test(r[2])).map(r => r[1]);
  ok('3.6 …and nothing still outstanding is seeded as done',
     !pendingRows.some(f => seeded.includes(f)),
     pendingRows.filter(f => seeded.includes(f)).join(', ') || pendingRows.length + ' outstanding');

  /* ⚠️ AND THE ONE HALF NO STATIC CHECK CAN REACH IS NAMED RATHER THAN
     PRETENDED. The live record is `public.migration_log` ON THE SERVER,
     and the net does not reach the server — so nothing here can know that
     a row was marked executed there while this column still says ⏳. That
     column has now aged three times (after `652`, after `655`, and after
     `656`), and the cause is structural: a human writes it BEFORE the run
     and nobody returns to it after. So what is guarded is that the
     sentence saying WHICH IS THE SOURCE stays written — delete it and the
     next reader takes this table for the record itself. */
  ok('3.7 the state file says the live record is the ledger and this column follows it',
     /`public\.migration_log`[\s\S]{0,200}سردٌ/.test(doc) || /السجلُّ الحيُّ `public\.migration_log`/.test(doc));
}

/* ============================================================
   4 — the ledger table itself
   ============================================================ */
console.log('--- 4: a table nobody but the runner reaches ---');
{
  const sql = sqlCode(read('supabase/migrations/' + LEDGER));
  ok('4.1 three columns and no more: which file, when, and from which commit',
     /create table if not exists public\.migration_log/.test(sql) &&
     /\bfile\s+text\s+primary key/.test(sql) && /\bran_at\s+timestamptz/.test(sql) && /\bcommit_sha\s+text/.test(sql));
  /* ⚠️ ARMED WITH NO POLICY, which is the point and not an oversight: the
     publishable key ships on every phone, and a reader who could write
     this table could mark a migration «executed» and close it for ever. */
  ok('4.2 row level security is armed on it', /alter table public\.migration_log enable row level security/.test(sql));
  ok('4.3 …and no policy is opened on it at all', !/create policy[^\n]*migration_log/.test(sql));
  ok('4.4 …and the API roles have their grants withdrawn as well',
     /revoke all on public\.migration_log from anon/.test(sql) &&
     /revoke all on public\.migration_log from authenticated/.test(sql));
  /* the app must never touch it — the runner writes it and nothing else */
  const js = ['js/store.js', 'js/app.js', 'js/ui.js']
    .concat(readdirSync(ROOT + 'js/screens').map(n => 'js/screens/' + n))
    .map(read).join('\n');
  ok('4.5 and the app never reads or writes it — the runner is its only writer',
     !/migration_log/.test(js));
  /* the SQL editor's paste field drops both characters, measured twice */
  ok('4.6 no `||` and no `*` in the SQL itself', !/\|\|/.test(sql) && !/\*/.test(sql));
}

/* ============================================================
   5 — one transaction, recorded only on success
   ============================================================ */
console.log('--- 5: it succeeds and is recorded, or neither ---');
{
  const sh = shCode(read(RUN));
  /* ⚠️ ONE TRANSACTION FOR THE FILE **AND** ITS RECORD — stronger than
     recording afterwards. A file that succeeded and failed to be recorded
     runs again next time; a file recorded without succeeding is closed
     for ever. psql runs -f and -c in the order given and --single-
     transaction wraps both. */
  const one = /apply_one\(\)\s*\{[\s\S]*?\n\}/.exec(sh);
  ok('5.1 the file and its record are one transaction',
     !!one && /--single-transaction/.test(one[0]) &&
     /-f\s+"\$DIR\/\$f"/.test(one[0]) && /insert into public\.migration_log/.test(one[0]));
  /* ⚠️ without ON_ERROR_STOP psql walks past a failed statement and exits
     0 — a migration failing in silence, the one outcome worse than a
     migration forgotten, because it looks done. */
  ok('5.2 …and psql is told to stop on the first error', !!one && /ON_ERROR_STOP=1/.test(one[0]));
  ok('5.3 the shell stops on an error rather than carrying on', /set -euo pipefail/.test(sh));
  /* a name that is not a migration is refused before it reaches SQL */
  ok('5.4 a file name that is not a migration is refused', !!one && /refusing a name that is not a migration/.test(read(RUN)));

  /* ⚠️ --single-transaction cannot wrap a statement that refuses to run
     inside one. Nothing in the folder may carry its own transaction
     control or a concurrent index, or the runner's guarantee is a fiction. */
  const bad = files.filter(f => {
    const s = sqlCode(readFileSync(MIG + f, 'utf8'));
    return /\bcreate\s+index\s+concurrently\b/i.test(s) || /^\s*(begin|commit|rollback)\s*;/im.test(s);
  });
  ok('5.5 no migration carries its own transaction control or a concurrent index',
     bad.length === 0, bad.join(', ') || files.length + ' files');
}

/* ============================================================
   6 — a second run does nothing, and the ledger is really read
   ============================================================ */
console.log('--- 6: the ledger is asked, not assumed ---');
{
  const sh = shCode(read(RUN));
  ok('6.1 the pending set is the folder minus what the ledger holds',
     /pending\(\)\s*\{[\s\S]*?ran\)[\s\S]*?migrations\)/.test(sh));
  /* ⚠️ discovered from the folder, never a list written in the script —
     the same reason run.sh derives its suites: a migration forgotten in a
     hand-written list never runs while the script reports success. */
  ok('6.2 the file list is discovered from the folder, not written down',
     /migrations\(\)\s*\{[\s\S]{0,300}?ls -1 "\$DIR"/.test(sh) &&
     !/0008_|0009_|0010_|0011_/.test(sh), 'no file name hard-coded but the ledger');
  ok('6.3 the ledger migration runs only when the ledger is absent',
     /ledger_exists \|\| \{[^}]*apply_one "\$LEDGER"/.test(sh));
  /* ⚠️ FOUND BY RUNNING IT, NOT BY READING IT: an unreachable database
     made `ledger_exists` answer «no», so the pull request commented «no
     pending migrations» and went green having never asked the server.
     A failure read as an answer is the swallowed failure this batch
     forbids. */
  ok('6.4 an unreachable server is announced, never read as an answer',
     /reachable\(\)/.test(sh) && /need_server/.test(sh) &&
     (sh.match(/need_server \|\| exit 1/g) || []).length === 2);

  /* ⚠️ AND THE CLASS, NOT THE INSTANCE. `6.4` closed the first example —
     an unreachable server read as «the table is not there». Sweeping the
     runner for the SHAPE rather than waiting for its next example found
     three more places where a failure could be read as an answer, and the
     rule this project already carries (`570`, `572`, `645`) is that a
     class is swept, never met one instance at a time. */
  ok('6.5 a failed read of the ledger is never «nothing pending»',
     !/\|\| true/.test(sh) && (sh.match(/P="\$\(pending\)" \|\|/g) || []).length === 2,
     '`|| true` in the code: ' + /\|\| true/.test(sh));
  ok('6.6 an empty or unreadable folder is never «nothing to run»',
     /migrations\(\)\s*\{[\s\S]*?\[ -n "\$out" \] \|\|/.test(sh));
  /* ⚠️ AND THE GUARD IS FOLLOWED TO ITS CONSUMER, which is where the third
     instance of this class was hiding: a command substitution in a FOR-LIST
     has its exit code swallowed — `set -e` never sees it — so `migrations`
     could fail loudly on stderr and the run still say «لا هجرةَ جديدة.» and
     exit 0. Every substitution in the runner must be assigned or explicitly
     tested, and this asserts the shape rather than the one line. */
  ok('6.6b …and no command substitution is left in a for-list, where its failure is swallowed',
     !/for\s+\w+\s+in\s+\$\(/.test(sh));
  /* ⚠️ AND NOTHING INSIDE `pending` LEANS ON `set -e`, which was MEASURED
     and not reasoned about: bash disables `-e` inside any command whose
     result is tested, and `pending` is always called `P="$(pending)" || {…}`
     — so `-e` was off for every line in it and the run exited 0 over a
     folder it could not read. What is tested is what holds. */
  ok('6.7a both reads inside `pending` are tested explicitly, never left to set -e',
     (/pending\(\)\s*\{[\s\S]*?done_list="\$\(ran\)" \|\| return 1/.test(sh)) &&
     (/pending\(\)\s*\{[\s\S]*?list="\$\(migrations\)" \|\| return 1/.test(sh)));
  /* only «t» or «f» is an answer; an error, an empty string or a refused
     permission is a failure and is announced */
  ok('6.7 …and only a real answer about the ledger counts as one',
     /ledger_exists\(\)\s*\{[\s\S]*?case "\$a" in[\s\S]*?\*\)[^\n]*exit 1/.test(sh));
}

/* ============================================================
   7 — nothing that is a secret enters the repository
   ============================================================ */
console.log('--- 7: the key is read by its name, and lives nowhere here ---');
{
  const sh = shCode(read(RUN));
  const wf = ymlCode(read(WF));
  ok('7.1 the key is read from the environment by its name alone',
     /SUPABASE_DB_URL/.test(sh) && /secrets\.SUPABASE_DB_URL/.test(wf));
  /* §4: a missing secret gets a comprehensible message, never an obscure crash */
  ok('7.2 a missing key says so in words', /المفتاح غير موجود/.test(read(RUN)));
  /* ⚠️ a fork's pull request carries no secret and that is not a failure;
     a migration that does not run on main must never look done. */
  ok('7.3 …and it is a failure where it must be and not where it must not',
     /need_key \|\| exit 0/.test(sh) && /need_key \|\| exit 1/.test(sh));
  /* ⚠️ NO SHELL TRACE. The run log of a PUBLIC repository is readable by
     anyone who opens the page, and a trace would print the command with
     the connection string in it. */
  ok('7.4 no shell trace anywhere in the runner', !/set -x/.test(sh));
  ok('7.5 …and the key is never echoed', !/echo[^\n]*\$\{?SUPABASE_DB_URL/.test(sh));

  /* ⚠️ THE WIDE SWEEP, AND IT IS DERIVED FROM `git ls-files` RATHER THAN
     A LIST — this batch's own argument applied to its own check. It is a
     different subject from `v75 · 3.1`, which asks what reaches the
     BROWSER over five named files; this asks what is in the REPOSITORY at
     all, because a database credential never goes near a browser and must
     never enter here either.
     The two generated builds are excluded because they are built FROM the
     sources: a secret can only reach them through a source, and their
     base64 module payloads carry `eyJ`-shaped runs by arithmetic. */
  let tracked = [];
  try {
    tracked = execSync('git ls-files', { cwd: ROOT, encoding: 'utf8' }).split('\n')
      .filter(Boolean).filter(f => !/^(index-single-file\.html|ARABNA-preview\.html)$/.test(f));
  } catch { /* no git in this environment */ }
  ok('7.6 the sweep reads the tracked files, and there are enough to be worth reading',
     tracked.length > 50, String(tracked.length));
  const CRED = /(sk_live|sk_test|sb_secret_)[A-Za-z0-9_-]{12,}|eyJhbGciOi[A-Za-z0-9_-]{10,}|AKIA[0-9A-Z]{16}|-----BEGIN [A-Z ]*PRIVATE KEY|postgres(?:ql)?:\/\/[^\s'"/]*:[^\s'"@]+@/;
  const dirty = tracked.filter(f => { try { return CRED.test(readFileSync(ROOT + f, 'utf8')); } catch { return false; } });
  ok('7.7 no key, and no connection string, anywhere in the repository',
     dirty.length === 0, dirty.join(', ') || tracked.length + ' files clean');
}

/* ============================================================
   8 — the ready-made step is pinned
   ============================================================ */
console.log('--- 8: pinned to a commit, never to a moving name ---');
{
  const wf = ymlCode(read(WF));
  const uses = [...wf.matchAll(/uses:\s*(\S+)/g)].map(m => m[1]);
  ok('8.1 the workflow uses a ready-made step at all', uses.length > 0, uses.length + ' steps');
  /* ⚠️ a 40-character commit, not `latest` and not a moving major tag: a
     major tag is re-pointed by its author and the change arrives without
     anybody here seeing it. */
  ok('8.2 every one of them is pinned to a full commit',
     uses.every(u => /@[0-9a-f]{40}$/.test(u)), uses.join(' '));
  ok('8.3 …and none of them is `latest`', !uses.some(u => /@latest$/.test(u)));
  /* ⚠️ and a concurrent run must never be cancelled: a cancelled run is a
     migration that did not happen and says nothing about it. */
  ok('8.4 two merges cannot run migrations at once, and a queued one is not cancelled',
     /concurrency:/.test(wf) && /cancel-in-progress:\s*false/.test(wf));
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
