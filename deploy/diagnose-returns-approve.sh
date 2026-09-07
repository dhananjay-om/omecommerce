#!/usr/bin/env bash
# Diagnostic only — makes no changes. Run this right after reproducing the
# "something went wrong" error on Fulfillment > Returns' Approve button,
# then copy everything it prints back into the chat so it can be debugged.
#
# It prints:
#   1. The last 300 lines of the api container's logs, filtered to anything
#      mentioning "return" (case-insensitive) — this is where the real
#      stack trace / error message for the failed request will be.
#   2. A quick check of whether the order_return / order_return_line tables
#      actually exist in this database (a real possibility: those tables
#      were added by an old migration back in mid-July, and if this
#      production database was ever restored/rebuilt since then without
#      every migration applied in order, they could be missing even though
#      the Phase 4 deploy script itself had no migration step of its own).
#
# Run from the repo root, after `git pull`: ./deploy/diagnose-returns-approve.sh
set -uo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

COMPOSE="docker compose -f docker-compose.prod.yml --env-file .env.production"

echo "==================================================================="
echo "1) Recent api logs mentioning 'return'"
echo "==================================================================="
$COMPOSE logs --tail=300 api 2>&1 | grep -i -A 30 "return" || echo "(nothing matched — try reproducing the error again right before running this script, logs may have rotated)"

echo
echo "==================================================================="
echo "2) Do the order_return tables exist?"
echo "==================================================================="
$COMPOSE exec -T postgres sh -c 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c "\d order_return"' 2>&1
$COMPOSE exec -T postgres sh -c 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c "\d order_return_line"' 2>&1

echo
echo "==================================================================="
echo "3) Applied migrations mentioning 'order'"
echo "==================================================================="
$COMPOSE exec -T postgres sh -c 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c "select migration_name, finished_at from _prisma_migrations where migration_name ilike '"'"'%order%'"'"' order by finished_at;"' 2>&1

echo
echo "==> Copy everything above this line back into the chat."
