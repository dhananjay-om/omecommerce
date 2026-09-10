#!/usr/bin/env bash
# Fixes "Shop by Category" on the home page showing a horizontal scrollbar
# — it was a flex-nowrap strip with overflow-x-auto, so once there were
# more categories than fit in one row (this store has 8), it turned into
# a horizontal scroller instead of wrapping. Now it wraps onto multiple
# centered rows instead, no scrollbar.
#
# Storefront only — no migration, no permission.
#
# Run from the repo root, after `git pull`: ./deploy/deploy-shop-by-category-wrap-fix.sh
set -uo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

COMPOSE="docker compose -f docker-compose.prod.yml --env-file .env.production"

echo "==> Rebuilding storefront"
$COMPOSE up -d --build storefront
if [ $? -ne 0 ]; then
  echo "!! storefront build/restart failed — see the output above" >&2
  exit 1
fi

echo
echo "==> Deploy complete. Reload the home page — 'Shop by Category' should"
echo "now wrap onto multiple rows instead of scrolling sideways."
