#!/usr/bin/env bash
# Diagnostic only — makes no changes. Round 3.
#
# Round 1 ruled out the database (tables + migrations fine). Round 2
# ruled out a stale deploy (api has the latest code, the logged-in
# admin's token has orders:refund). But we still haven't actually
# CAUGHT the failed request — there's a health-check hitting the server
# every ~10 seconds, which floods the logs fast enough that by the time
# you reproduce the error and then run a script, it's usually already
# scrolled out of the window.
#
# This version flips the order to fix that: it watches the LIVE log
# stream for 60 seconds, filtering out the health-check noise, so
# whatever really happens is guaranteed to be caught.
#
# HOW TO RUN THIS ONE:
#   1. Run this script FIRST: ./deploy/diagnose-returns-approve.sh
#   2. As soon as it prints "Watching now — go click Approve on the
#      Returns page...", switch to the browser and click Approve.
#   3. Wait for the script to finish on its own (60 seconds), then copy
#      everything it printed back into the chat.
set -uo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

COMPOSE="docker compose -f docker-compose.prod.yml --env-file .env.production"

echo "Watching now — go click Approve on the Returns page in your browser."
echo "(waiting 60 seconds, then this will stop on its own)"
echo "==================================================================="
timeout 60 $COMPOSE logs -f --since=1s api 2>&1 | grep -v '"url":"/health"'
echo "==================================================================="
echo "==> Done watching. Copy everything above this line back into the chat."
echo "    (if it printed nothing, the request may not be reaching the api"
echo "    container at all — copy the browser's own error/console output"
echo "    instead, if you can get to it via F12 > Console / Network tab)"
