#!/bin/bash
# Every suite against both builds, two at a time.
#
#   python3 -m http.server 8099        # from the repo root
#   tools/e2e/run.sh                   # ~25 minutes
#
# These live in the repository ON PURPOSE. They spent five batches in a
# scratch directory and a container reset destroyed three of them at once,
# taking the only regression cover batches six (b), seven and seven (a)
# had. The net is what enforces "never break a working feature", so it
# belongs with the thing it protects.
cd "$(dirname "$0")"
HOST="${HOST:-http://localhost:8099}"
SUITES="${SUITES:-3 4 5 6 7 8 9 10 11 12 13 14 15 16 17 18 19 20 21 22 23 24 25 26 27 28 29 30 31 32 33 34 35 36 37 38 39 40 41 42 43 44}"
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
echo ALLDONE
if [ -s "$BAD" ]; then
  echo "RED: $(wc -l < "$BAD" | tr -d ' ') suite run(s) failed — $(tr '\n' ' ' < "$BAD")"
  rm -f "$BAD"; exit 1
fi
rm -f "$BAD"
exit 0
