#!/usr/bin/env bash
# Diagnostic only — makes no changes. Round 2: the first pass found the
# order_return tables and migrations fine, but ZERO log lines mentioning
# "return" even right after reproducing the error — which points at a
# stale container (one of api/admin still running an older image that
# predates the Fulfillment: Returns/Pick & Pack work) rather than a
# database problem. This checks that directly, with no credentials
# needed, by looking for files/routes that only exist in the latest
# build.
#
# Run from the repo root, after `git pull`: ./deploy/diagnose-returns-approve.sh
set -uo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

COMPOSE="docker compose -f docker-compose.prod.yml --env-file .env.production"

echo "==================================================================="
echo "1) Is the api container actually running the Returns/Pick&Pack code?"
echo "   (checks for files that only exist from those commits onward)"
echo "==================================================================="
$COMPOSE exec -T api sh -c '
  for f in \
    dist/src/modules/order/application/update-return-status.usecase.js \
    dist/src/modules/order/application/refund-return.usecase.js \
    dist/src/modules/order/application/list-pick-list.usecase.js \
    dist/src/modules/inventory/application/set-bin-location.usecase.js
  do
    if [ -f "$f" ]; then echo "PRESENT: $f"; else echo "MISSING: $f  <-- stale image, needs rebuild"; fi
  done
' 2>&1

echo
echo "==================================================================="
echo "2) When did the api container last (re)start, and what image is it on?"
echo "==================================================================="
$COMPOSE ps api 2>&1
docker inspect --format 'Started: {{.State.StartedAt}}   Image: {{.Image}}' "$($COMPOSE ps -q api)" 2>&1

echo
echo "==================================================================="
echo "3) Same check for the admin container (does the built UI include"
echo "   the new Returns/Pick & Pack pages?)"
echo "==================================================================="
$COMPOSE exec -T admin sh -c '
  find .next -type d -iname "pick-pack" -o -type d -iname "returns" 2>/dev/null | head -20
' 2>&1
$COMPOSE ps admin 2>&1
docker inspect --format 'Started: {{.State.StartedAt}}   Image: {{.Image}}' "$($COMPOSE ps -q admin)" 2>&1

echo
echo "==================================================================="
echo "4) Full recent api logs, unfiltered (last 150 lines) — in case the"
echo "   real error is there but didn't literally contain the word 'return'"
echo "==================================================================="
$COMPOSE logs --tail=150 api 2>&1

echo
echo "==> Copy everything above this line back into the chat."
