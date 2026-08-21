#!/usr/bin/env bash
# Deploys the "View Store" (admin header) and "View Product" (product
# pages) links. Admin-only change, no database migration.
#
# Run from the repo root, after `git pull`: ./deploy/deploy-view-store-links.sh
set -uo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

COMPOSE="docker compose -f docker-compose.prod.yml --env-file .env.production"

echo "==> Rebuilding admin"
$COMPOSE up -d --build admin
if [ $? -ne 0 ]; then
  echo "!! build/restart failed — see the output above" >&2
  exit 1
fi

echo
echo "==> Deploy complete. Look for 'View Store' in the top-right of any"
echo "    admin page, and 'View Product' on a product's detail/edit page."
