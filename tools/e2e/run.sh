#!/bin/bash
# Every suite against both builds, two at a time.
#
#   python3 -m http.server 8099        # from the repo root
#   tools/e2e/run.sh                   # ~1h45 (measured 5 Sep 2026 · 72 suites × 2 builds)
#
# These live in the repository ON PURPOSE. They spent five batches in a
# scratch directory and a container reset destroyed three of them at once,
# taking the only regression cover batches six (b), seven and seven (a)
# had. The net is what enforces "never break a working feature", so it
# belongs with the thing it protects.
cd "$(dirname "$0")"
HOST="${HOST:-http://localhost:8099}"
# ⚠️ THE LIST IS DERIVED FROM THE FILES, NEVER WRITTEN BY HAND.
# It was a literal string, and nothing compared it against
# `tools/e2e/test_v*.mjs` — so a suite file forgotten in it is never run,
# while `run.sh` exits with zero FAIL and «ALLDONE» and the net reads
# GREEN WITHOUT HAVING SEEN THE FILE. That is a check that lies, of the
# same family as `test_v36`'s hand-written port, `test_v37`'s flat wait,
# and `test_v50` computing the day in a timezone the browser was not in.
#
# ⚠️ And the measurement that makes it heavier than it looks: three
# numbers were added to that string in ONE DAY — 50, 51 and 52, in three
# separate batches, each by hand. Had one been forgotten nobody would have
# noticed: the only figure that would have shown it is the run count in
# the report — AND THAT FIGURE WAS ITSELF MISREAD THE SAME DAY, 48 for 49.
# A guard whose only guard has already failed is not a guard.
#
# ⚠️ The pattern is deliberately strict — `test_v` then DIGITS ONLY then
# `.mjs` — so a spare copy named `test_v9_old.mjs` cannot walk into the
# net through the back door. And the sort is NUMERIC: a lexical sort puts
# 10 before 9 and the report reads as though the run jumped.
DERIVED=$(ls test_v*.mjs 2>/dev/null \
  | sed -n 's/^test_v\([0-9][0-9]*\)\.mjs$/\1/p' | sort -n | tr '\n' ' ')
DERIVED_N=$(echo $DERIVED | wc -w)
# ⚠️ A derivation that fails SILENTLY is worse than a hand-written list,
# because it is assumed safe: a pattern matching nothing would exit zero
# with «ALLDONE», which is the very fault being fixed. The floor is
# WRITTEN, not computed — a threshold derived from the thing it guards
# always agrees with itself.
if [ "$DERIVED_N" -lt 40 ]; then
  echo "*** ABORT: derived only $DERIVED_N suite(s) from test_v<n>.mjs — the pattern is wrong ***"
  exit 2
fi
# ⚠️ The manual override stays. Running three suites while you work is what
# keeps a batch from paying the full hour and three quarters, and deleting it would
# slow every batch down. The derived list is the DEFAULT, nothing more.
SUITES="${SUITES:-$DERIVED}"
RUN_N=$(echo $SUITES | wc -w)
# ⚠️ Printed in full, once, at the head: a stray file is seen in the first
# line rather than an hour and three quarters later. And the COUNT is printed at both
# ends, so the report carries the number instead of somebody counting the
# lines by hand — which is exactly how «48» happened.
#
# ⚠️ AND IT PRINTS WHAT IS ACTUALLY RUNNING, not the derived default. The
# first version printed «SUITES (50)» over a run of two, which is a report
# lying about its own scope — the very fault this batch exists to remove.
# When an override is in force the derived count is printed BESIDE it, so
# a partial run can never be mistaken for a full net.
if [ "$RUN_N" -eq "$DERIVED_N" ]; then
  echo "SUITES ($RUN_N): $SUITES"
else
  echo "SUITES ($RUN_N of $DERIVED_N — PARTIAL, not the full net): $SUITES"
fi
# A suite that CRASHES prints no "passed," line at all, and counting only
# `^FAIL` reported that as "0 FAIL" — which is how an aborted v15 once read
# as green. The exit code is the truth; the counts are the detail.
# The exit code has to travel out of the two background subshells, or
# `daily.sh` prints "suites: clean" over a red run — which is the same
# fault as counting only `^FAIL` and reading a crashed suite as zero.
# Clear the previous run's per-suite files first. They are not the report
# — the summary lines are — but they are what somebody reads while a run
# is in progress, and a stale set from an earlier run sitting beside the
# current one reads as progress that has not happened. It misled me into
# reporting a run near v38 when it was at v9.
rm -f /tmp/e2e-m-*.txt /tmp/e2e-s-*.txt
BAD=$(mktemp)
run() {
  build=$1; tag=$2
  for v in $SUITES; do
    BASE="$HOST/$build" node test_v$v.mjs > /tmp/e2e-$tag-$v.txt 2>&1
    code=$?
    [ $code -ne 0 ] && echo "$tag v$v" >> "$BAD"
    line=$(grep -a 'passed,' /tmp/e2e-$tag-$v.txt | tail -1)
    if [ -z "$line" ]; then
      echo "$tag v$v: *** CRASHED (exit $code) — no result line ***"
      tail -6 /tmp/e2e-$tag-$v.txt
    else
      echo "$tag v$v: $line | $(grep -ac '^FAIL' /tmp/e2e-$tag-$v.txt) FAIL$([ "$code" != 0 ] && echo " (exit $code)")"
      grep -a '^FAIL' /tmp/e2e-$tag-$v.txt | head -5
    fi
  done
  echo "DONE-$tag"
}
run index.html m &
run index-single-file.html s &
wait
echo "SUITES ($RUN_N$([ "$RUN_N" -ne "$DERIVED_N" ] && echo " of $DERIVED_N — PARTIAL")) — a different number here means a run went missing"
echo ALLDONE
if [ -s "$BAD" ]; then
  echo "RED: $(wc -l < "$BAD" | tr -d ' ') suite run(s) failed — $(tr '\n' ' ' < "$BAD")"
  rm -f "$BAD"; exit 1
fi
rm -f "$BAD"
exit 0
