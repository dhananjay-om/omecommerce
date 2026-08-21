#!/usr/bin/env bash
# Deploys the Magento-style bulk stock quantity import feature (admin
# uploads a CSV of sku,quantity rows, sets on-hand at a chosen warehouse).
# Touches the backend API (new route + worker dispatch) and the admin UI.
# No database migration.
#
# Run from the repo root, after `git pull`: ./deploy/deploy-bulk-stock-import.sh
set -uo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

COMPOSE="docker compose -f docker-compose.prod.yml --env-file .env.production"

echo "==> Rebuilding backend API (routes + bulk-jobs worker)"
$COMPOSE up -d --build api
if [ $? -ne 0 ]; then
  echo "!! backend build/restart failed — see the output above" >&2
  exit 1
fi

echo "==> Rebuilding admin"
$COMPOSE up -d --build admin
if [ $? -ne 0 ]; then
  echo "!! admin build/restart failed — see the output above" >&2
  exit 1
fi

echo
echo "==> Deploy complete. Bulk Update Stock is under Inventory in the admin sidebar."
