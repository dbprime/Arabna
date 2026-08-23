#!/bin/bash
# The whole check, in one command, in one report.
#
#   python3 -m http.server 8099        # from the repo root
#   tools/audit/daily.sh
#
# The static pass runs FIRST because it takes seconds and needs no
# browser: if a key is missing, knowing that before thirty-five minutes of
# browser work is worth the two seconds.
cd "$(dirname "$0")/../.."
echo "=== ARABNA · $(date -u '+%Y-%m-%d %H:%M UTC') · $(git rev-parse --short HEAD) ==="
echo
echo "--- static ---"
node tools/audit/wiring.mjs . ; STATIC=$?
echo
echo "--- suites (both builds) ---"
tools/e2e/run.sh ; SUITES=$?
echo
echo "=== RESULT ==="
[ $STATIC -eq 0 ] && echo "static: clean" || echo "static: FAILED"
[ $SUITES -eq 0 ] && echo "suites: clean" || echo "suites: FAILED"
exit $(( STATIC || SUITES ))
