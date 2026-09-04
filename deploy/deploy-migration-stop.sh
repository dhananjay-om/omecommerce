#!/usr/bin/env bash
# Adds a "Stop" button to a running Data Migration — a real, verified
# feature, not just a UI toggle.
#
# A running migration now shows a Stop button. Clicking it requests a
# COOPERATIVE stop, never a hard kill: the worker checks a cancel flag
# before starting each product and stops there, so it can never leave a
# product half-created (its category/attribute/variant/media writes
# aren't one DB transaction). Whatever already migrated before the stop
# stays real and stays — clicking Check Migration + Start again later
# picks up exactly where it left off, skipping everything already done.
#
# New MigrationRunStatus value (CANCELLED) + a cancel_requested column —
# a real migration, applied via `prisma migrate deploy` below. No new
# permission (reuses migration:manage).
#
# Verified live end-to-end against a real running job (a local mock
# Shopify server, since no real store was available this session): Start
# -> Stop mid-run -> confirmed the DB had exactly the real committed
# products and nothing half-created -> ran Check Migration + Start again
# -> confirmed every already-migrated product was correctly skipped, not
# duplicated (same distinct-SKU count before and after).
#
# Run from the repo root, after `git pull`: ./deploy/deploy-migration-stop.sh
set -uo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

COMPOSE="docker compose -f docker-compose.prod.yml --env-file .env.production"

echo "==> Rebuilding api (Stop/cancel support in the catalog-migration worker)"
$COMPOSE up -d --build api
if [ $? -ne 0 ]; then
  echo "!! api build/restart failed — see the output above" >&2
  exit 1
fi

echo "==> Applying the new CANCELLED status + cancel_requested column"
$COMPOSE exec api npm run migrate:deploy
if [ $? -ne 0 ]; then
  echo "!! migration failed — see the output above, copy it back" >&2
  exit 1
fi

echo "==> Rebuilding admin (Stop button on a running migration)"
$COMPOSE up -d --build admin
if [ $? -ne 0 ]; then
  echo "!! admin build/restart failed — see the output above" >&2
  exit 1
fi

echo
echo "==> Deploy complete. No new permission — reuses migration:manage."
echo "Start a migration, watch the progress bar, and try Stop — it'll stop"
echo "after the product currently in progress, and Check Migration + Start"
echo "again later resumes exactly where it left off."
