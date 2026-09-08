#!/bin/bash
# Every suite against both builds, two at a time.
#
#   python3 -m http.server 8099        # from the repo root
#   tools/e2e/run.sh
#
# ⚠️ NO DURATION IS WRITTEN HERE ANY MORE, AND THAT IS THE POINT OF 615.
# There were three hand-written figures for one run — «~50 min» in
# CLAUDE.md, «~25 minutes» in this head, and a third in the gate table —
# and no two of them agreed, because the net was 43 suites when the first
# was typed and is 80 now. A number written by hand ages with nobody
# noticing; `run.sh` MEASURES its own time and prints it at the tail of
# every run, per suite and per build. Read it there.
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
# ⚠️ THE RESULTS OF ONE TREE ACCUMULATE; THE RESULTS OF ANOTHER ARE WIPED.
# The full net is run ON SEGMENTS — the container is suspended whenever the
# session goes idle, so one long invocation freezes with it (measured once:
# two and a half hours of wall clock against ninety seconds of work). The
# old line here was `rm -f /tmp/e2e-m-*.txt /tmp/e2e-s-*.txt`, so THE LAST
# SEGMENT ERASED THE EVIDENCE OF EVERY SEGMENT BEFORE IT and «the whole net
# is green» became a sentence somebody added up by hand — which is the same
# arithmetic that once printed 48 for 49.
#
# The reason that line existed is still right and is kept: a stale set from
# an EARLIER TREE sitting beside the current one reads as progress that has
# not happened. So the wipe is made conditional rather than deleted — the
# folder is named after the tree, and only other trees' folders go.
SHA=$(git rev-parse --short HEAD 2>/dev/null || echo nogit)
OUT="/tmp/e2e-$SHA"
mkdir -p "$OUT"
for d in /tmp/e2e-*; do
  [ -e "$d" ] || continue
  [ "$d" = "$OUT" ] && continue
  rm -rf "$d"
done
INDEX="$OUT/index.tsv"
BAD=$(mktemp)
# ⚠️ `$SECONDS` and not `date`: a counter bash keeps itself, with no second
# process spawned inside a loop that turns 160 times, and no dependence on a
# format that differs between systems.
run() {
  build=$1; tag=$2
  t_build=$SECONDS
  for v in $SUITES; do
    t0=$SECONDS
    BASE="$HOST/$build" node test_v$v.mjs > "$OUT/$tag-$v.txt" 2>&1
    code=$?
    dt=$((SECONDS - t0))
    [ $code -ne 0 ] && echo "$tag v$v" >> "$BAD"
    line=$(grep -a 'passed,' "$OUT/$tag-$v.txt" | tail -1)
    nfail=$(grep -ac '^FAIL' "$OUT/$tag-$v.txt")
    if [ -z "$line" ]; then
      echo "$tag v$v: *** CRASHED (exit $code) — no result line *** [${dt}s]"
      tail -6 "$OUT/$tag-$v.txt"
      # a crash has no assertion count of its own — recorded as one, and
      # the verdict below counts it apart rather than silently as zero
      printf '%s\t%s\t%s\t%s\t%s\t%s\n' "$tag" "$v" "0" "0" "$dt" "CRASH" >> "$INDEX"
    else
      echo "$tag v$v: $line | $nfail FAIL [${dt}s]$([ "$code" != 0 ] && echo " (exit $code)")"
      grep -a '^FAIL' "$OUT/$tag-$v.txt" | head -5
      npass=$(echo "$line" | sed -n 's/^\([0-9][0-9]*\) passed.*/\1/p')
      nf=$(echo "$line" | sed -n 's/.*, \([0-9][0-9]*\) failed.*/\1/p')
      printf '%s\t%s\t%s\t%s\t%s\t%s\n' "$tag" "$v" "${npass:-0}" "${nf:-0}" "$dt" "OK" >> "$INDEX"
    fi
  done
  echo "DONE-$tag [$((SECONDS - t_build))s]"
}
run index.html m &
run index-single-file.html s &
wait
echo "SUITES ($RUN_N$([ "$RUN_N" -ne "$DERIVED_N" ] && echo " of $DERIVED_N — PARTIAL")) — a different number here means a run went missing"
echo "INVOCATION: ${SECONDS}s"

# ⚠️ THE VERDICT IS READ FROM THE INDEX, NEVER ADDED UP BY HAND.
# Each segment still announces itself PARTIAL above — that guard is not
# softened and not switched off — and COMPLETENESS is declared here and
# only here, from the accumulated index of one tree. A sentence somebody
# summed across nineteen segments is a sentence, not a measurement.
#
# ⚠️ And it reads the LAST line for each (build, suite): a suite re-run
# after a fix counts once, with its latest result, so a re-run neither
# inflates the count nor keeps its old red alive.
awk -F'\t' -v derived="$DERIVED" -v sha="$SHA" -v out="$OUT" '
  { key = $1 "\t" $2; pass[key]=$3; fail[key]=$4; secs[key]=$5; state[key]=$6;
    build[$1]=1; }
  END {
    n = split(derived, D, " ");
    print "";
    print "INDEX  " out "/index.tsv   ·   HEAD " sha;
    runs=0; asserts=0; reds=0; crashes=0;
    for (k in pass) { runs++; asserts+=pass[k]+fail[k]; reds+=fail[k];
                      if (state[k]=="CRASH") crashes++;
                      split(k, P, "\t"); tot[P[1]] += secs[k]; seen[k]=1; }
    # the COUNT is always printed and the names are capped: a working run
    # of three suites would otherwise bury its own result under a hundred
    # and fifty lines naming everything it did not ask for.
    miss=""; nmiss=0;
    for (b in build) for (i=1;i<=n;i++) if (D[i] != "" && !((b "\t" D[i]) in seen)) {
      nmiss++; if (nmiss <= 20) miss = miss " " b "/v" D[i]; }
    if (nmiss > 20) miss = miss " …";
    distinct=0; for (k in seen) { split(k,P,"\t"); if (!(P[2] in su)) { su[P[2]]=1; distinct++; } }
    nb=0; for (b in build) nb++;
    printf "  runs %d   ·   %d distinct suite(s) × %d build(s)   ·   %d derived\n", runs, distinct, nb, n;
    printf "  assertions %d   ·   FAIL %d   ·   CRASH %d\n", asserts, reds, crashes;
    for (b in build) printf "  build %s: %ds in this index (all segments)\n", b, tot[b];
    # ⚠️ and BOTH builds, named: a net measured on one build is not the net,
    # and «distinct == derived» alone would say COMPLETE over half of it.
    if (nmiss == 0 && distinct == n && ("m" in build) && ("s" in build))
      print "  NET COMPLETE — every derived suite ran on both builds in this index";
    else
      printf "  NET INCOMPLETE — %d run(s) missing:%s\n", nmiss, miss;
    print "  SLOWEST:";
    for (k in secs) { split(k, P, "\t"); printf "    %s v%-3s %4ds\n", P[1], P[2], secs[k] | "sort -rn -k3 | head -10"; }
    close("sort -rn -k3 | head -10");
  }' "$INDEX"
echo ALLDONE
if [ -s "$BAD" ]; then
  echo "RED: $(wc -l < "$BAD" | tr -d ' ') suite run(s) failed — $(tr '\n' ' ' < "$BAD")"
  rm -f "$BAD"; exit 1
fi
rm -f "$BAD"
exit 0
