#!/usr/bin/env bash
# ============================================================
# ARABNA — the migration runner (652)
#
# Until this file existed, every migration in `supabase/migrations/` was
# executed by hand in the Supabase SQL editor, and `docs/الحالة.md` §1.ج
# records what that cost: TWO of the first seven had silently never run,
# and nobody could have known — the repository said one thing and the
# database another, for weeks, with no signal anywhere.
#
# ⚠️ NOT THE OFFICIAL `supabase` CLI, and the reason is measured rather
# than preferred. That tool expects a fourteen-digit timestamp prefix
# (20260908143000_name.sql) where ours are `0001_schema.sql`, and it keeps
# a ledger of its own that knows nothing of the seven already executed by
# hand. So it drags two problems behind it that are not ours — a naming
# convention against our own, and a ledger we do not own — and what we
# need from it is one line out of a hundred it does. The price is said and
# not hidden: WE maintain this file now.
#
# ⚠️ AND IT IS ONE SCRIPT CALLED BY BOTH DOORS, never the same logic
# written twice in two YAML blocks. A rule written twice has two versions
# two batches later, and this project has paid for that with `esc()`.
#
#   tools/migrate.sh list      what has not run — prints nothing else
#   tools/migrate.sh comment   the same, posted on the pull request
#   tools/migrate.sh apply     runs it, on `main` and nowhere else
#
# ⚠️ NO `set -x` ANYWHERE IN THIS FILE, and that is a security line and
# not a style one: the connection string carries the password, the run log
# of a PUBLIC repository is readable by anyone who opens the page, and a
# shell trace would print the command with the secret in it. The secret is
# read from the environment, is never echoed, and never reaches a log —
# measured after a successful run AND after a failed one.
# ============================================================
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DIR="$ROOT/supabase/migrations"

# ⚠️ The ledger migration is named here because it is the ONE file the
# runner must execute before it can ask anything — it is what creates the
# table the question is put to. Everything else is discovered.
LEDGER="0012_migration_ledger.sql"

# ⚠️ Discovered from the folder, sorted, never a list written in this file.
# The same reason `run.sh` derives its suites: a migration forgotten in a
# hand-written list is a migration that never runs, while the script
# reports success.
migrations() {
  local out; out="$(ls -1 "$DIR" | grep -E '^[0-9]{4}_[a-z0-9_]+\.sql$' | sort)"
  # ⚠️ An unreadable or empty folder must never read as «nothing to run».
  # It is the same swallowed failure as the one below, one level further out.
  [ -n "$out" ] || { echo "لم يُقرأ أيُّ ملفِّ هجرةٍ من $DIR — ولا يُستنتج من ذلك أنّ لا شيءَ ينتظر." >&2; return 1; }
  printf '%s\n' "$out"
}

need_key() {
  if [ -z "${SUPABASE_DB_URL:-}" ]; then
    echo "المفتاح غير موجود — أضِف السرَّ SUPABASE_DB_URL في:" >&2
    echo "  Settings → Secrets and variables → Actions → New repository secret" >&2
    echo "the key is not present: add the SUPABASE_DB_URL repository secret." >&2
    return 1
  fi
}

# ⚠️ The connection string is passed as an argument because libpq has no
# environment variable for a whole URI, and §5 asks for ONE value the owner
# pastes once rather than five fields. The runner is single-tenant and
# ephemeral, so the only process that could read its argv is our own job,
# and GitHub masks a registered secret in the log. It is written down
# rather than glossed over.
q() { psql "$SUPABASE_DB_URL" -X -q -A -t -v ON_ERROR_STOP=1 "$@"; }

# ⚠️ THE CONNECTION IS PROVEN BEFORE ANYTHING IS CONCLUDED FROM ITS
# SILENCE, and this was found by running it rather than by reading it.
# Without this line an unreachable database made `ledger_exists` answer
# «no» — so the pull request commented «لا هجرةَ معلَّقة» and the job went
# green, having never asked the server at all. A failure read as an answer
# is the swallowed failure this whole batch exists to forbid.
reachable() { q -c "select 1" >/dev/null 2>&1; }

need_server() {
  if ! reachable; then
    echo "تعذّر الاتّصال بقاعدة البيانات — لم يُسأل الخادمُ ولا يُستنتج من صمته شيء." >&2
    echo "could not reach the database: the server was never asked, and nothing is concluded from its silence." >&2
    return 1
  fi
}

# ⚠️ ONLY «t» OR «f» IS AN ANSWER. Anything else — an error, an empty
# string, a refused permission — is a FAILURE and is announced. Reading a
# failure as «the table is not there» is what the first run of this file
# did, and it is the fault this whole batch forbids.
ledger_exists() {
  local a; a="$(q -c "select to_regclass('public.migration_log') is not null")" || a=''
  case "$a" in
    t) return 0 ;;
    f) return 1 ;;
    *) echo "لم يُجب الخادمُ عن وجود جدول السجلّ — ولا يُستنتج من صمته شيء." >&2; exit 1 ;;
  esac
}

ran() { q -c "select file from public.migration_log order by file"; }

# ⚠️ ONE TRANSACTION FOR THE FILE **AND** ITS RECORD, which is stronger
# than «record it afterwards»: psql runs -f and -c in the order given, and
# `--single-transaction` wraps both, so either the change and its record
# both land or neither does. A file that succeeded and failed to be
# recorded would run again next time; a file recorded without succeeding
# would be closed for ever.
#
# ⚠️ And ON_ERROR_STOP=1 is not decoration — without it psql walks past a
# failed statement and exits 0, which is a migration failing in silence:
# the one outcome worse than a migration forgotten, because it looks done.
apply_one() {
  local f="$1"
  case "$f" in
    [0-9][0-9][0-9][0-9]_*.sql) ;;
    *) echo "refusing a name that is not a migration: $f" >&2; return 1 ;;
  esac
  echo "  → $f"
  psql "$SUPABASE_DB_URL" -X -q -v ON_ERROR_STOP=1 --single-transaction \
    -f "$DIR/$f" \
    -c "insert into public.migration_log (file, ran_at, commit_sha)
        values ('$f', now(), '${COMMIT_SHA:-}') on conflict (file) do nothing"
}

pending() {
  local done_list list f
  # ⚠️ EXPLICIT `|| return 1`, NEVER A RELIANCE ON `set -e` — and this was
  # measured, not reasoned about. Bash DISABLES `set -e` inside any command
  # whose result is tested, and `pending` is always called as
  # `P="$(pending)" || { … }`, so `-e` is off for everything inside it: the
  # folder guard printed its warning and the run still exited 0. `set -e` is
  # a convenience at the top level and a guarantee nowhere. What is tested
  # is what holds.
  done_list="$(ran)" || return 1
  # ⚠️ ASSIGNED, NEVER `for f in $(migrations)`. A command substitution in a
  # for-list has its exit code SWALLOWED — `set -e` does not see it — so the
  # folder guard printed its warning to stderr and the run went on to say
  # «لا هجرةَ جديدة.» and exit 0. That is the swallowed failure surviving one
  # level further out than the fix for it, and it is the third instance of
  # this one class in this batch. An assignment is checked; a for-list is not.
  list="$(migrations)" || return 1
  for f in $list; do
    printf '%s\n' "$done_list" | grep -qxF "$f" || printf '%s\n' "$f"
  done
}

case "${1:-}" in

  # ------------------------------------------------------------
  # list / comment — READ, and never write. This is the price of the
  # decision, named by the owner himself: «a wrong migration lands on
  # production without your ever seeing it». So the pull request shows
  # what will run BEFORE the merge button — which is more than is visible
  # today, not less.
  # ------------------------------------------------------------
  list|comment)
    need_key || exit 0        # a pull request with no key is not a failure
    need_server || exit 1     # ⚠️ but an unreachable one IS, and loudly
    if ! ledger_exists; then
      echo "جدولُ السجلّ غير موجود بعد — ينشئه ويزرعه $LEDGER في أوّل تشغيلٍ على main." >&2
      exit 0
    fi
    # ⚠️ NEVER `|| true` HERE. A failed read of the ledger is not «no
    # pending migrations» — it is a failure, and saying «لا هجرةَ معلَّقة»
    # over it is the swallowed failure, in the runner that forbids it.
    P="$(pending)" || { echo "تعذّرت قراءةُ سجلّ الهجرات." >&2; exit 1; }
    [ "${1}" = "list" ] && { [ -n "$P" ] && printf '%s\n' "$P"; exit 0; }

    if [ -z "$P" ]; then echo "لا هجرةَ معلَّقة."; exit 0; fi

    BODY="### الهجرات التي ستُنفَّذ عند الدمج"$'\n\n'
    BODY="${BODY}لم تُنفَّذ بعد، وستُنفَّذ على \`main\` بعد الدمج — كلُّ ملفٍّ في حَوطةٍ واحدة."$'\n'
    for f in $P; do
      BODY="${BODY}"$'\n'"<details><summary><code>${f}</code></summary>"$'\n\n'
      BODY="${BODY}"'```sql'$'\n'"$(head -c 20000 "$DIR/$f")"$'\n''```'$'\n\n</details>'$'\n'
    done
    BODY="${BODY}"$'\n'"_لا تراجعَ عن هجرة — الحمايةُ هي هذا العرضُ قبل التنفيذ، لا التراجعُ بعده._"
    # a failure to comment must not fail the check — the finding is in the log either way
    printf '%s' "$BODY" | gh pr comment "${PR:?}" --body-file - || printf '%s\n' "$BODY"
    ;;

  # ------------------------------------------------------------
  # apply — and the caller is what guarantees this is `main`. It is
  # guarded twice in the workflow (the trigger's own branch filter, and an
  # `if` on the job): a branch that could execute means everyone who
  # pushes a branch writes on production, which unpicks «main is
  # production» from behind.
  # ------------------------------------------------------------
  apply)
    need_key || exit 1        # here a missing key IS a failure, and loudly
    need_server || exit 1
    # ⚠️ The ledger migration runs first and ONLY when the ledger is
    # absent — so on the first run it is the first thing executed, and on
    # every run after it nothing at all is executed when nothing is new.
    # It records itself through the ordinary path, so the loop then skips
    # it and there is no special case anywhere below.
    ledger_exists || { echo "إنشاءُ جدول السجلّ:"; apply_one "$LEDGER"; }
    P="$(pending)" || { echo "تعذّرت قراءةُ سجلّ الهجرات." >&2; exit 1; }
    if [ -z "$P" ]; then echo "لا هجرةَ جديدة."; exit 0; fi
    echo "تنفيذ:"
    for f in $P; do apply_one "$f"; done
    echo "تمّ $(printf '%s\n' "$P" | wc -l | tr -d ' ')"
    ;;

  *) echo "usage: migrate.sh [list|comment|apply]" >&2; exit 2 ;;
esac
