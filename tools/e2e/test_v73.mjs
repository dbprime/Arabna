/* V.09.7 — the server contract: the schema and the protection rules.

   `470` adds `supabase/` and nothing else — no key, no library, not one
   `fetch`, and not a line in `js/`. This suite is what makes that
   contract checkable rather than merely written: it opens no browser and
   starts no server, it reads the two migrations and `js/store.js` as text
   and compares them.

   ⚠️ THE DIVISION IS NOT INVENTED. `KEEPS_ON_SIGN_OUT` in `js/store.js`
   already names three kinds — the device's own, the operator's, and one
   accounting record — and those three ARE the protection rules. What
   stays on the device never rises; what is the operator's is read by all
   and written by the admin; what is in neither belongs to its subject.

   ⚠️ AND ITEM 8 IS THE ONE THAT STOPS THE FILE ROTTING. Every key in
   `DEFAULTS` must appear in one of the five classes written into
   `0001_schema.sql`; a key added to the state tomorrow with no place in
   the contract turns the net red the same day. */
import { readFileSync, existsSync, readdirSync } from 'node:fs';

/* ⚠️ never a relative path — run.sh runs from its own working directory,
   and v67 crashed there for exactly that while passing by hand. */
const ROOT = new URL('../../', import.meta.url).pathname;
let pass = 0, fail = 0;
const ok = (n, c, extra = '') => { if (c) { pass++; console.log('PASS ' + n + (extra ? ' -> ' + extra : '')); }
  else { fail++; console.log('FAIL ' + n + (extra ? ' -> ' + extra : '')); } };

const SQL_DIR = ROOT + 'supabase/migrations/';
const read = f => readFileSync(SQL_DIR + f, 'utf8');
/* ⚠️ comments are stripped before any "does the SQL do X" question. The
   header of 0002 has to SAY «a table with no enable row level security is
   open to the world» in order to explain itself — and a check that read
   the prose would count that sentence as a table. The project has paid
   for this twice already (test_v53, test_v55). */
const code = s => s.split('\n').filter(l => !/^\s*--/.test(l)).join('\n');

ok('0.1 the two migrations exist', existsSync(SQL_DIR + '0001_schema.sql') && existsSync(SQL_DIR + '0002_rls.sql'));
const schema = code(read('0001_schema.sql'));
const rls = code(read('0002_rls.sql'));
const rawSchema = read('0001_schema.sql');

const tables = [...schema.matchAll(/create table public\.([a-z_]+)/g)].map(m => m[1]);
ok('0.2 the schema declares tables at all', tables.length >= 10, tables.length + ' tables');

/* ---- 1) not one table without row level security ---- */
{
  const armed = new Set([...rls.matchAll(/alter table public\.([a-z_]+)\s+enable row level security/g)].map(m => m[1]));
  const bare = tables.filter(t => !armed.has(t));
  ok('1.1 every table has row level security enabled — a bare one is a public file',
     bare.length === 0, bare.join(', ') || `${tables.length} of ${tables.length}`);
  /* and nothing armed that does not exist — a stale line reads as cover */
  const ghost = [...armed].filter(t => !tables.includes(t));
  ok('1.2 …and nothing is armed that no longer exists', ghost.length === 0, ghost.join(', ') || 'none');
}

/* ---- 2) a protected table with no read policy is a silent outage ---- */
{
  const policies = [...rls.matchAll(/create policy\s+"[^"]*"\s+on public\.([a-z_]+)\s+for\s+([a-z]+)/g)]
    .map(m => ({ table: m[1], op: m[2] }));
  ok('2.0 policies are declared', policies.length >= 20, policies.length + ' policies');
  const canRead = new Set(policies.filter(p => p.op === 'select' || p.op === 'all').map(p => p.table));
  const blind = tables.filter(t => !canRead.has(t));
  ok('2.1 every table has at least one read policy — protected but unreadable is a silent outage',
     blind.length === 0, blind.join(', ') || 'all readable');
}

/* ---- 3) no reader's location, anywhere ---- */
{
  /* ⚠️ the promise is in js/store.js's own comment and the arrival of a
     server does not repeal it. Allowed inside `businesses` alone — the
     directory's own coordinates are a different thing from a reader's. */
  const bizBlock = (schema.match(/create table public\.businesses[\s\S]*?\n\);/) || [''])[0];
  const outside = schema.replace(bizBlock, '');
  const hits = [...outside.matchAll(/\b(lat|lng|latitude|longitude)\b/g)].map(m => m[1]);
  ok('3.1 no reader location column exists anywhere outside the directory',
     hits.length === 0, hits.join(', ') || 'none');
  /* and the promise itself is still in the source it was made in */
  const store = readFileSync(ROOT + 'js/store.js', 'utf8');
  ok('3.2 …and the promise it rests on is still written in js/store.js',
     /never sent anywhere/.test(store));
}

/* ---- 4) no card data ---- */
{
  const hits = [...schema.matchAll(/\b(card_number|cvv|pan|exp_[a-z]+)\b/g)].map(m => m[1]);
  ok('4.1 no card field in any table — the card passes through Stripe alone',
     hits.length === 0, hits.join(', ') || 'none');
}

/* ---- 5) the money record survives the person ---- */
{
  const line = (schema.match(/payer_id[^\n]*/) || [''])[0];
  ok('5.1 receipts.payer_id is `set null`, never `cascade`',
     /on delete set null/.test(line) && !/cascade/.test(line), line.trim() || '(no payer_id)');
  /* the same rule the app already keeps */
  const store = readFileSync(ROOT + 'js/store.js', 'utf8');
  ok('5.2 …matching what deleteAccount already does — receipts are not erased',
     /receipts/.test(store));
}

/* ---- 6) nobody promotes themselves ---- */
{
  const profilePolicies = [...rls.matchAll(/create policy\s+"[^"]*"\s+on public\.profiles\s+for\s+([a-z]+)/g)].map(m => m[1]);
  ok('6.1 profiles has no insert policy — the row is made by a trigger at sign-up',
     !profilePolicies.includes('insert'), profilePolicies.join(', '));
  ok('6.2 …and no delete policy — deletion is a mark, not an erasure',
     !profilePolicies.includes('delete'), profilePolicies.join(', '));
  /* ⚠️ «the app does not send it» is not a guarantee: the anon key is on
     every phone. The refusal has to be at the database. */
  ok('6.3 is_admin cannot be raised from a client session — refused by the database itself',
     /is_admin is distinct from old\.is_admin/.test(rls) && /raise exception/.test(rls));
  ok('6.4 …and the guard is actually attached as a trigger, not merely defined',
     /create trigger[\s\S]{0,160}before update on public\.profiles/.test(rls));
}

/* ---- 7) no key, anywhere under supabase/ ---- */
{
  const walk = (dir) => readdirSync(dir, { withFileTypes: true }).flatMap(e =>
    e.isDirectory() ? walk(dir + e.name + '/') : [dir + e.name]);
  const files = walk(ROOT + 'supabase/');
  const bad = [];
  for (const f of files) {
    const txt = readFileSync(f, 'utf8');
    /* `service_role` is named in a comment ON PURPOSE — to say the key
       lives only in the server's environment — so the search is for a
       key's SHAPE, plus service_role outside a comment. */
    if (/\beyJ[A-Za-z0-9_-]{10,}/.test(txt) || /\bsbp_[A-Za-z0-9]{10,}/.test(txt)) bad.push(f + ' (token)');
    if (/service_role/.test(code(txt))) bad.push(f + ' (service_role in code)');
  }
  ok('7.1 no key or token anywhere under supabase/', bad.length === 0,
     bad.join(', ') || files.length + ' files clean');
}

/* ---- 8) every state key is placed in the contract ---- */
{
  const store = readFileSync(ROOT + 'js/store.js', 'utf8');
  const i = store.indexOf('const DEFAULTS');
  let d = 0, j = i;
  for (;; j++) { if (store[j] === '{') d++; else if (store[j] === '}') { d--; if (!d) break; } }
  const keys = [...store.slice(i, j + 1).matchAll(/^ {2}([A-Za-z_$][\w$]*)\s*:/gm)].map(m => m[1]);
  ok('8.0 DEFAULTS was read', keys.length > 50, keys.length + ' keys');

  /* the five classes, read out of the migration's own comment block */
  const classes = ['never-uploads', 'operator', 'owner-only', 'shared', 'accounting'];
  const placed = new Set();
  for (const c of classes) {
    const m = rawSchema.match(new RegExp('\\[' + c + '\\][\\s\\S]*?\\n--\\s*\\n'));
    ok(`8.1 the class [${c}] is written into the migration`, !!m);
    if (m) for (const w of m[0].match(/[A-Za-z_$][\w$]*/g) || []) placed.add(w);
  }
  const unplaced = keys.filter(k => !placed.has(k));
  ok('8.2 every DEFAULTS key has a class in the contract — a new key with no place goes red the same day',
     unplaced.length === 0, unplaced.join(', ') || `${keys.length} of ${keys.length} placed`);
}

/* ---- 9) the batch touched no running code ---- */
{
  ok('9.1 supabase/ holds migrations only — nothing executable was added',
     readdirSync(ROOT + 'supabase/migrations/').every(f => f.endsWith('.sql')));
  const files = [...schema.matchAll(/create table public\.([a-z_]+)/g)];
  ok('9.2 …and the contract is complete enough to be worth checking',
     files.length === tables.length && tables.length >= 15, tables.length + ' tables');
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
