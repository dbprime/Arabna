#!/bin/bash
# tools/audit/quick.sh — the fast gate, called after every change.
#
#   python3 -m http.server 8099        # from the repo root
#   tools/audit/quick.sh
#
# ⚠️ This does NOT replace daily.sh. It catches most faults in about a
# minute; daily.sh catches the rest in about twenty, and is called ONCE at
# the end of a session.
#
# What this does not check: the single-file build · the four roles · the
# admin panel · the calendar · the deep cases in the other thirty-five
# suites.
cd "$(dirname "$0")/../.."
HOST="${HOST:-http://localhost:8099}"

echo "=== QUICK · $(date -u '+%H:%M UTC') · $(git rev-parse --short HEAD) ==="
echo
echo "--- static ---"
node tools/audit/wiring.mjs . ; ST=$?
echo
echo "--- the 42 screens, both languages, on index.html ---"
BASE="$HOST/index.html" node tools/e2e/test_v37.mjs ; SM=$?
echo
echo "=== RESULT-QUICK ==="
[ $ST -eq 0 ] && echo "static: clean" || echo "static: FAILED"
[ $SM -eq 0 ] && echo "screens: clean" || echo "screens: FAILED"
exit $(( ST || SM ))
